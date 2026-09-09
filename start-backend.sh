#!/bin/bash
cd "$(dirname "$0")"
export $(grep -v '^#' .env | xargs)
cd server
npm run dev
