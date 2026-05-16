"""
웹 크롤러 모듈.
Velog에서 백엔드 개발자 면접 관련 글을 수집한다.
"""

import time
import requests
from dataclasses import dataclass


@dataclass
class CrawledArticle:
    """크롤링된 글 한 건."""
    title: str
    url: str
    content: str
    source: str


# 백엔드 면접 관련 검색 키워드 목록
BACKEND_KEYWORDS = [
    "백엔드 면접질문",
    "Spring 면접",
    "Java 면접 질문",
    "백엔드 기술면접",
    "Spring Boot 면접",
    "JPA 면접",
    "MySQL 면접",
    "Redis 면접",
    "Docker 면접",
    "AWS 면접",
]


def crawl_velog_posts(keyword: str, limit: int = 5) -> list[CrawledArticle]:
    """
    Velog GraphQL API를 이용해 키워드 관련 글을 가져온다.

    Args:
        keyword: 검색 키워드
        limit: 가져올 글 수
    """
    graphql_url = "https://v2.velog.io/graphql"
    query = """
    query SearchPosts($keyword: String!, $limit: Int) {
        searchPosts(keyword: $keyword, limit: $limit) {
            posts {
                title
                url_slug
                user {
                    username
                }
            }
        }
    }
    """
    variables = {"keyword": keyword, "limit": limit}

    try:
        resp = requests.post(
            graphql_url,
            json={"query": query, "variables": variables},
            headers={"Content-Type": "application/json"},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        posts = data.get("data", {}).get("searchPosts", {}).get("posts", [])
    except Exception as e:
        print(f"[크롤러] Velog 검색 실패 ({keyword}): {e}")
        return []

    articles: list[CrawledArticle] = []
    for post in posts:
        username = post["user"]["username"]
        slug = post["url_slug"]
        post_url = f"https://velog.io/@{username}/{slug}"

        content = _fetch_velog_content(username, slug)
        if content:
            articles.append(CrawledArticle(
                title=post["title"],
                url=post_url,
                content=content,
                source="velog",
            ))
            time.sleep(1)  # 서버 부담 방지

    return articles


def _fetch_velog_content(username: str, slug: str) -> str | None:
    """Velog GraphQL로 개별 글 본문을 가져온다."""
    graphql_url = "https://v2.velog.io/graphql"
    query = """
    query ReadPost($username: String!, $url_slug: String!) {
        post(username: $username, url_slug: $url_slug) {
            body
        }
    }
    """
    variables = {"username": username, "url_slug": slug}

    try:
        resp = requests.post(
            graphql_url,
            json={"query": query, "variables": variables},
            headers={"Content-Type": "application/json"},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        body = data.get("data", {}).get("post", {}).get("body", "")
        return body if body else None
    except Exception as e:
        print(f"[크롤러] 본문 가져오기 실패 (@{username}/{slug}): {e}")
        return None


def crawl_backend_interview(limit_per_keyword: int = 3) -> list[CrawledArticle]:
    """
    백엔드 면접 관련 키워드 전체를 순회하며 크롤링한다.

    Args:
        limit_per_keyword: 키워드당 가져올 글 수 (기본 3)

    Returns:
        전체 크롤링 결과 리스트
    """
    all_articles: list[CrawledArticle] = []
    seen_urls: set[str] = set()

    for keyword in BACKEND_KEYWORDS:
        print(f"[크롤러] 검색 중: {keyword}")
        articles = crawl_velog_posts(keyword, limit=limit_per_keyword)

        for article in articles:
            if article.url not in seen_urls:
                seen_urls.add(article.url)
                all_articles.append(article)

        time.sleep(2)  # 키워드 간 대기

    print(f"[크롤러] 총 {len(all_articles)}건 수집 완료 (중복 제거)")
    return all_articles
