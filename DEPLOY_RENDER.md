# Render Deployment

## 1. Push to GitHub

Render deploys from a Git repository. Push this project to GitHub first.

## 2. Create the web service

1. Create a new `Web Service`.
2. Connect the GitHub repository for this project.
3. Render should detect `render.yaml` automatically.

## 3. Set environment variables

Add these values in Render:

- `DATABASE_URL=<your Neon connection string>`
- `OPENAI_API_KEY=sk-...`
- `OPENAI_MODEL=gpt-5`

Do not upload a local `.env` file to Render.

## 4. Deploy

Render will run:

- Build command: `npm install`
- Start command: `npm start`

The app exposes:

- Main app: `/`
- Health check: `/health`

## 5. Use the public URL

After deployment, open the Render service URL from any device.

## Notes

- DB is hosted on Neon, app server is hosted on Render
- If you already restored data into Neon, no extra DB migration is needed during deploy
- After the first deploy, Render gives you a public `https://...onrender.com` URL
