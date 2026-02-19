import { NextResponse } from "next/server";

export function apiError(message: string, status: number = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function now(): string {
  return new Date().toISOString();
}
