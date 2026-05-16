"""
S3 업로더 모듈.
크롤링한 원문을 .txt 파일로 S3에 업로드한다.
Knowledge Base가 이 버킷을 데이터 소스로 사용하여
자동으로 청크 분할 → 임베딩 → 인덱싱을 수행한다.
"""

import os
import uuid
from datetime import datetime, timezone

import boto3
from dotenv import load_dotenv

from .crawler import CrawledArticle

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env.local"))

AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME", "interview-crawled-data")
S3_PREFIX = os.getenv("S3_PREFIX", "crawled/")


def _get_s3_client():
    """S3 클라이언트를 생성한다."""
    return boto3.client("s3", region_name=AWS_REGION)


def upload_article(article: CrawledArticle) -> str:
    """
    크롤링된 글 1건을 .txt로 S3에 업로드한다.

    Returns:
        업로드된 S3 키 (경로)
    """
    s3 = _get_s3_client()

    doc_id = str(uuid.uuid4())
    s3_key = f"{S3_PREFIX}{doc_id}.txt"

    content = (
        f"[메타데이터]\n"
        f"제목: {article.title}\n"
        f"출처: {article.url}\n"
        f"주제: 백엔드 개발자 면접\n"
        f"소스: {article.source}\n"
        f"수집일: {datetime.now(timezone.utc).isoformat()}\n"
        f"\n"
        f"[본문]\n"
        f"{article.content}"
    )

    s3.put_object(
        Bucket=S3_BUCKET_NAME,
        Key=s3_key,
        Body=content.encode("utf-8"),
        ContentType="text/plain; charset=utf-8",
    )

    print(f"[S3] 업로드 완료: s3://{S3_BUCKET_NAME}/{s3_key}")
    return s3_key


def upload_articles(articles: list[CrawledArticle]) -> list[str]:
    """여러 글을 일괄 업로드한다."""
    keys = []
    for article in articles:
        key = upload_article(article)
        keys.append(key)
    print(f"[S3] 총 {len(keys)}건 업로드 완료")
    return keys


def sync_knowledge_base(knowledge_base_id: str, data_source_id: str):
    """
    Knowledge Base 동기화(Sync)를 트리거한다.
    S3에 새 파일을 올린 뒤 호출하면 Knowledge Base가 새 데이터를 인덱싱한다.
    """
    client = boto3.client("bedrock-agent", region_name=AWS_REGION)

    response = client.start_ingestion_job(
        knowledgeBaseId=knowledge_base_id,
        dataSourceId=data_source_id,
    )

    job_id = response["ingestionJob"]["ingestionJobId"]
    print(f"[KB] 동기화 시작: jobId={job_id}")
    return job_id
