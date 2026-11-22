# Deploy BizPulse to Google Cloud Run

This deploys the existing BizPulse Express + Vite application from this repository. It does **not** move the project to another hosting provider.

## 1. Select the Google Cloud project

In Google Cloud Console, select the project that owns Firebase project **relaunch-bizpulse**. Confirm billing is enabled. Do not paste API keys or service-account JSON into GitHub or this document.

Install and authenticate the Google Cloud CLI, then run:

```bash
gcloud auth login
gcloud config set project relaunch-bizpulse
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com
```

If your Google Cloud project ID is different, replace `relaunch-bizpulse` with the actual project ID. The Firebase client code currently targets `relaunch-bizpulse`, so do not change projects without also updating Firebase configuration.

## 2. Add the Gemini key to Secret Manager

Create a Gemini API key in Google AI Studio for the intended Google Cloud project. Keep it private.

```bash
printf '%s' 'PASTE_YOUR_GEMINI_API_KEY_HERE' | gcloud secrets create bizpulse-gemini-api-key --data-file=-
```

If the secret already exists, add a new version instead:

```bash
printf '%s' 'PASTE_YOUR_GEMINI_API_KEY_HERE' | gcloud secrets versions add bizpulse-gemini-api-key --data-file=-
```

Do not include the key in source code, a .env file committed to GitHub, or a screenshot.

## 3. Configure the Cloud Run service identity for Firebase

Cloud Run must be allowed to verify Firebase ID tokens and read each signed-in user's case records in Firestore.

Create a dedicated runtime service account:

```bash
gcloud iam service-accounts create bizpulse-runtime --display-name="BizPulse Cloud Run runtime"
```

Grant the minimum project roles required by the current server implementation:

```bash
gcloud projects add-iam-policy-binding relaunch-bizpulse --member="serviceAccount:bizpulse-runtime@relaunch-bizpulse.iam.gserviceaccount.com" --role="roles/datastore.user"
gcloud projects add-iam-policy-binding relaunch-bizpulse --member="serviceAccount:bizpulse-runtime@relaunch-bizpulse.iam.gserviceaccount.com" --role="roles/firebaseauth.admin"
gcloud secrets add-iam-policy-binding bizpulse-gemini-api-key --member="serviceAccount:bizpulse-runtime@relaunch-bizpulse.iam.gserviceaccount.com" --role="roles/secretmanager.secretAccessor"
```

If the service account already exists, do not create it again. These IAM changes require project-owner or equivalent IAM administration permission.

## 4. Deploy

Run this command from the repository root (the folder containing this Dockerfile):

```bash
gcloud run deploy bizpulse \
  --source . \
  --region australia-southeast1 \
  --platform managed \
  --service-account bizpulse-runtime@relaunch-bizpulse.iam.gserviceaccount.com \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production,GEMINI_MODEL=gemini-3.8-flash \
  --set-secrets GEMINI_API_KEY=bizpulse-gemini-api-key:latest \
  --memory 1Gi \
  --cpu 1 \
  --timeout 300 \
  --max-instances 2
```

Cloud Run will print a Service URL after a successful deployment. Open that URL to load the app.

The service is publicly reachable so customers can load the website; application API routes still require Firebase sign-in. Do not interpret public website access as public access to customer records.

## 5. Important first-deployment checks

1. In Firebase Console for project `relaunch-bizpulse`, enable the sign-in provider used by the app (email/password).
2. Confirm Firestore is created and the app's Firestore security rules are deployed.
3. Confirm the Cloud Run runtime service account has the IAM roles above.
4. Register the Cloud Run URL in Firebase Authentication > Settings > Authorized domains if the sign-in flow requires it.
5. Test registration, sign-in, creating a business case, saving it, and one AI coaching request.
6. Test document analysis and report downloads only after the basic flow works.

## Cost and billing safeguards

- `--max-instances 2` limits Cloud Run scaling; it is not a guaranteed monthly dollar cap.
- Gemini API usage is billed separately from Cloud Run. Set a budget/alert and, where available for the selected Gemini billing account, a Gemini API spend cap in Google AI Studio.
- This deployment does not activate Stripe subscriptions or customer billing.
- Check Google Cloud Billing and AI Studio usage before inviting pilot customers.

## Notes

- This repository currently starts the Express server with `npm run start`; the Dockerfile builds the Vite frontend and runs that server on Cloud Run's supplied `PORT`.
- The server's Firebase Admin SDK uses Application Default Credentials on Cloud Run. Do not upload a Firebase service-account JSON file.
- The configured Gemini model name must be available to the API key. If the first AI request returns a model-not-found error, set `GEMINI_MODEL` to a model currently enabled for that key.
- This is deployment configuration, not a completed production security or end-to-end acceptance test. Run the first-deployment checks before real customer use.
