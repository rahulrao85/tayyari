# Deployment (Google Cloud Run)

The app is one container: the Node server serves the API and the precompressed front end.

```bash
PROJECT=your-project
REGION=asia-south1
NUMBER=$(gcloud projects describe "$PROJECT" --format="value(projectNumber)")

# 1. Store the Gemini key in Secret Manager (never in the image or the repo)
printf '%s' "$GEMINI_API_KEY" | gcloud secrets create tayyari-gemini-key --data-file=- --project "$PROJECT"

# 2. Let the Cloud Run service account read it
gcloud secrets add-iam-policy-binding tayyari-gemini-key --project "$PROJECT" \
  --member "serviceAccount:${NUMBER}-compute@developer.gserviceaccount.com" \
  --role roles/secretmanager.secretAccessor

# 3. Build with Cloud Build from the Dockerfile and deploy
gcloud run deploy tayyari --source . --region "$REGION" --project "$PROJECT" \
  --allow-unauthenticated --set-secrets GEMINI_API_KEY=tayyari-gemini-key:latest \
  --memory 512Mi --max-instances 3
```

Optional: `--set-env-vars GEMINI_MODELS=gemini-3.5-flash,gemini-3-flash-preview` changes the model chain.

Logs are one JSON object per line with `severity` and `httpRequest`, so Cloud Logging shows them as structured entries.
`GET /api/health` is a cheap readiness check that never calls the model.
