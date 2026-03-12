"use client"
import Image from "next/image";
import { useEffect, useState } from "react";

export default async function Home() {

  const res = await fetch("http://127.0.0.1:8000/api/hello")
  const data = await res.json()

  return (
    <div>
      <h1>{data.message}</h1>
    </div>
  )
}