"""LiveKit Cloud에 남아있는 모든 Room을 삭제하는 스크립트."""
import asyncio
import os
from dotenv import load_dotenv
from livekit import api

load_dotenv()


async def main():
    lk = api.LiveKitAPI(
        os.getenv("LIVEKIT_URL"),
        os.getenv("LIVEKIT_API_KEY"),
        os.getenv("LIVEKIT_API_SECRET"),
    )

    rooms = await lk.room.list_rooms(api.ListRoomsRequest())
    if not rooms.rooms:
        print("열려있는 방 없음. 깨끗한 상태!")
    else:
        print(f"열려있는 방 {len(rooms.rooms)}개 발견. 삭제 중...")
        for room in rooms.rooms:
            print(f"  삭제: {room.name}")
            await lk.room.delete_room(api.DeleteRoomRequest(room=room.name))
        print("전부 삭제 완료!")

    await lk.aclose()


if __name__ == "__main__":
    asyncio.run(main())
