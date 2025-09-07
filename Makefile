PROJECT ?= solid-study-467023-i3
SERVICE ?= orchestrator
REGION  ?= us-central1
URL     ?= https://$(SERVICE)-$(REGION)-a.run.app

.PHONY: deploy-staging promote smoke test-100 live-10 rollback

deploy-staging:
	gcloud run deploy $(SERVICE) --source . --project $(PROJECT) --region $(REGION) \
	  --allow-unauthenticated --no-traffic \
	  --cpu 1 --memory 1Gi --timeout 300 \
	  --service-account orchestrator-sa@$(PROJECT).iam.gserviceaccount.com \
	  --set-env-vars NODE_ENV=production,GOOGLE_CLOUD_PROJECT=$(PROJECT),GCS_BUCKET=$(PROJECT)-ai-assets,IMAGE_RATE=0.002,DAILY_BUDGET_LIMIT=5,SSE_ENABLED=1,BUDGET_LEDGER_ENABLED=1,GEMINI_API_KEY=AIzaSyBYekAymMYfkh3OmVJKAU8LMbeU4JGYnwo

promote:
	gcloud run services update-traffic $(SERVICE) --project $(PROJECT) --region $(REGION) --to-latest

smoke:
	curl -fsS "$(URL)/healthz" && echo OK
	curl -fsS "$(URL)/metrics-lite" | python3 -m json.tool

test-100:
	API_BASE="$(URL)" pnpm tsx scripts/run-100-batch.ts

live-10:
	API_BASE="$(URL)" pnpm tsx scripts/run-10-live.ts

rollback:
	gcloud run services update-traffic $(SERVICE) --project $(PROJECT) --region $(REGION) --to-revisions $(REV)=100