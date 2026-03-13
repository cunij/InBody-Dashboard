# Render Deployment

## 1. Push to GitHub

Render deploys from a Git repository. Push this project to GitHub first.

## 2. Create the database

1. Open Render.
2. Create a new `Postgres` database.
3. Open the database details page.
4. Copy the `Internal Database URL`.

## 3. Create the web service

1. Create a new `Web Service`.
2. Connect the GitHub repository for this project.
3. Render should detect `render.yaml` automatically.

## 4. Set environment variables

Add these values in Render:

- `DATABASE_URL=<your Render Postgres internal database URL>`
- `OPENAI_API_KEY=sk-...`
- `OPENAI_MODEL=gpt-5`

Do not upload a local `.env` file to Render.

## 5. Deploy

Render will run:

- Build command: `npm install`
- Start command: `npm start`

The app exposes:

- Main app: `/`
- Health check: `/health`

## 6. Use the public URL

After deployment, open the Render service URL from any device.
