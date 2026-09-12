# Slack Integration — CI/CD Notifications

Automated Slack notifications for GitHub Actions pipeline events.

## Setup

### 1. Create Slack App

1. Go to https://api.slack.com/apps
2. Click "Create New App"
3. Choose "From scratch"
4. App name: `TicSol Logistics Hub CI/CD`
5. Workspace: Your workspace
6. Click "Create App"

### 2. Enable Incoming Webhooks

1. In app settings, go to "Incoming Webhooks"
2. Toggle "Activate Incoming Webhooks" to On
3. Click "Add New Webhook to Workspace"
4. Choose channel: `#deployments` (for production)
5. Click "Allow"
6. Copy the webhook URL

**Repeat for staging:**
- Channel: `#development`
- Webhook URL for staging

### 3. Add Webhooks to GitHub Secrets

```bash
# For production channel
gh secret set SLACK_WEBHOOK_PROD --body "https://hooks.slack.com/services/YOUR/WEBHOOK/URL"

# For development channel
gh secret set SLACK_WEBHOOK_DEV --body "https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
```

Or via GitHub UI:
1. Repository → Settings → Secrets and variables → Actions
2. New repository secret
3. Name: `SLACK_WEBHOOK_PROD`
4. Value: (paste webhook URL)
5. Repeat for `SLACK_WEBHOOK_DEV`

### 4. Test Webhook

```bash
curl -X POST -H 'Content-type: application/json' \
  --data '{"text":"Test message"}' \
  YOUR_WEBHOOK_URL
```

## Notifications

### Trigger Points

| Event | Channel | Notification |
|-------|---------|--------------|
| Tests pass | (none) | Silent pass |
| Tests fail | `#development` | ⚠️ CI Tests - FAILED |
| E2E fail | `#development` | 🚨 E2E Tests - FAILED |
| Staging deploy | `#development` | ✅ Staging Deployment - SUCCESS |
| Staging fail | `#development` | ❌ Staging Deployment - FAILED |
| Production deploy | `#deployments` | ✅ Production Deployment - SUCCESS |
| Production fail | `#deployments` | ❌ Production Deployment - FAILED |

### Message Format

**Success Notification:**
```
✅ Production Deployment - SUCCESS
Repository: your-org/ticsol-logistics-hub
Branch: master
Commit: abc123def456
Author: username

[View Logs] [View Commit]
```

**Failure Notification:**
```
❌ Production Deployment - FAILED
Repository: your-org/ticsol-logistics-hub
Branch: master
Commit: abc123def456
Author: username

[View Logs] [View Commit]
```

## Customization

### Modify Notification Payload

Edit `.github/workflows/ci.yml` to customize:

```yaml
- name: Notify Slack
  uses: slackapi/slack-github-action@v1
  with:
    webhook-url: ${{ secrets.SLACK_WEBHOOK_PROD }}
    payload: |
      {
        "text": "Custom message",
        "blocks": [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "Your *custom* message"
            }
          }
        ]
      }
```

### Slack Message Format

**Text:** Simple text message (markdown supported)

**Blocks:** Rich formatting (sections, buttons, images)

Example sections:
```json
{
  "type": "section",
  "text": {
    "type": "mrkdwn",
    "text": "*Bold* _italic_ `code` <https://example.com|link>"
  }
}
```

Example buttons:
```json
{
  "type": "actions",
  "elements": [
    {
      "type": "button",
      "text": {"type": "plain_text", "text": "Click me"},
      "url": "https://example.com"
    }
  ]
}
```

## Advanced: Slack Workflows

Combine with Slack Workflows for:
- Auto-reply on deployment
- Pin deployment messages
- Create Jira issues on failure
- Post to multiple channels
- Send direct messages

## Troubleshooting

### Webhook not working

1. Check secret name matches workflow: `SLACK_WEBHOOK_PROD`
2. Verify webhook URL is correct (starts with `https://hooks.slack.com/`)
3. Test manually: `curl -X POST ... YOUR_WEBHOOK_URL`
4. Check Slack app permissions

### Messages not appearing

1. Check channel exists and bot has access
2. Review workflow run logs for errors
3. Verify `if:` conditions (e.g., `if: failure()`)
4. Test with simpler payload

### Rate limiting

Slack allows ~1 message per second per webhook.

If hitting limits:
- Batch multiple events
- Use Slack Workflow delays
- Separate critical/non-critical webhooks

## Security

- Never commit webhook URLs to Git
- Use GitHub repository secrets
- Rotate webhooks periodically
- Limit app permissions to minimum needed
- Monitor webhook access logs

## Integration with Other Tools

### Opsgenie (on-call alerts)

Add to critical failure payload:

```json
{
  "type": "section",
  "text": {
    "type": "mrkdwn",
    "text": "🚨 <opsgenie://trigger?tags=critical|Alert On-Call>"
  }
}
```

### Jira (auto-create issues)

Combine with Slack's Jira integration:

```yaml
- uses: actions/github-script@v6
  if: failure()
  with:
    script: |
      // Create Jira issue
      const title = `CI/CD Failure: ${context.payload.repository.name}`;
      // Call Jira API
```

### PagerDuty (incidents)

```bash
curl -X POST https://events.pagerduty.com/v2/enqueue \
  -H 'Content-Type: application/json' \
  -d '{
    "routing_key": "YOUR_INTEGRATION_KEY",
    "event_action": "trigger",
    "dedup_key": "baf3b3eb3da41dfb6a41db4d3b3da41d",
    "payload": {
      "summary": "Production deployment failed",
      "severity": "critical",
      "source": "GitHub Actions"
    }
  }'
```

## Links

- Slack API Docs: https://api.slack.com/
- GitHub Action: https://github.com/slackapi/slack-github-action
- Message Format: https://api.slack.com/reference/block-kit
- Incoming Webhooks: https://api.slack.com/messaging/webhooks
