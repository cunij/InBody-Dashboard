# 인바디 트래커

체중, 체지방률, 골격근량을 입력해서 브라우저 `localStorage`에 저장하고, 그래프와 AI 평가를 확인하는 간단한 웹앱입니다.

## 변경된 구조

- 인바디 기록 저장: 브라우저 `localStorage`
- OpenAI API 키 저장: 프로젝트 루트의 `.env`
- AI 호출 위치: 브라우저가 아니라 Node 서버

브라우저는 `.env`를 직접 읽을 수 없어서, 서버가 `OPENAI_API_KEY`를 읽고 `/api/analyze`를 통해 OpenAI를 호출합니다.

## 실행

1. `.env.example`을 참고해서 루트에 `.env` 파일을 만듭니다.
2. `OPENAI_API_KEY`를 넣습니다.
3. 아래 명령으로 서버를 실행합니다.

```bash
npm start
```

4. 브라우저에서 [http://localhost:3000](http://localhost:3000)을 엽니다.

## .env 예시

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5
PORT=3000
```

## 참고

- `.env`는 `.gitignore`에 추가되어 있습니다.
- API 키가 없거나 서버 호출이 실패하면 프론트에서 로컬 규칙 기반 평가로 자동 대체됩니다.
- OpenAI 호출은 `POST /v1/responses`를 사용합니다. 공식 예시도 Responses API와 `response.output_text` 접근을 사용합니다.
