"""
백엔드 면접 자료 크롤링 → S3 업로드 스크립트.

사용법:
    python -m pipeline.run_crawl
    (interview-agent 디렉토리에서 실행)

옵션:
    --limit 3              키워드당 크롤링할 글 수 (기본: 3)
    --sync                 업로드 후 Knowledge Base 동기화
    --kb-id ID             Knowledge Base ID
    --data-source-id ID    데이터 소스 ID
"""

import argparse

from .crawler import crawl_backend_interview
from .s3_uploader import upload_articles, sync_knowledge_base


def main():
    parser = argparse.ArgumentParser(
        description="백엔드 면접 자료 크롤링 → S3 → Knowledge Base"
    )
    parser.add_argument("--limit", type=int, default=3,
                        help="키워드당 크롤링할 글 수")
    parser.add_argument("--sync", action="store_true",
                        help="업로드 후 Knowledge Base 동기화")
    parser.add_argument("--kb-id", default="",
                        help="Knowledge Base ID")
    parser.add_argument("--data-source-id", default="",
                        help="데이터 소스 ID")
    args = parser.parse_args()

    # 1. 크롤링
    print("=" * 50)
    print("[STEP 1] 백엔드 면접 자료 크롤링")
    print("=" * 50)
    articles = crawl_backend_interview(limit_per_keyword=args.limit)

    if not articles:
        print("크롤링된 글이 없습니다. 종료합니다.")
        return

    # 2. S3 업로드
    print("=" * 50)
    print(f"[STEP 2] S3 업로드 ({len(articles)}건)")
    print("=" * 50)
    upload_articles(articles)

    # 3. Knowledge Base 동기화 (옵션)
    if args.sync:
        if not args.kb_id or not args.data_source_id:
            print("[경고] --sync 사용 시 --kb-id와 --data-source-id가 필요합니다.")
        else:
            print("=" * 50)
            print("[STEP 3] Knowledge Base 동기화")
            print("=" * 50)
            sync_knowledge_base(args.kb_id, args.data_source_id)

    print("=" * 50)
    print("완료!")
    print("=" * 50)


if __name__ == "__main__":
    main()
