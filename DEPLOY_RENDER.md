# Render Deployment

## 1. Push to GitHub

Render deploys from a Git repository. Push this project to GitHub first.

## 2. Create the service

1. Open Render.
2. Create a new `Web Service`.
3. Connect the GitHub repository for this project.
4. Render should detect `render.yaml` automatically.

## 3. Set environment variables

Add these values in Render:

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
