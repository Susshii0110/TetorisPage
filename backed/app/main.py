from fastapi import FastAPI

app = FastAPI() # FastAPIのインスタンスを作成

@app.get("/")
async def root():
    return {"message": "FastAPI is working"}

@app.get("/api/hello") # ルーてィング
async def hello():
    return {"message": "Hello, World from FastAPI!"}