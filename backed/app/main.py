from fastapi import FastAPI

app = FastAPI() # FastAPIのインスタンスを作成

@app.get("/") # ルーてィング
async def root():
    return {"message": "Hello, World!"}