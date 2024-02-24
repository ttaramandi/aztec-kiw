#!/usr/bin/env bash
[ -n "${BUILD_SYSTEM_DEBUG:-}" ] && set -x # conditionally trace
set -eu

extract_repo docs /usr/src extracted-repo
cd extracted-repo/src/docs
npm install netlify-cli -g

DEPLOY_OUTPUT=""

# Check if we're on master
if [ "$1" = "master" ]; then
    # Deploy to production if the argument is "master"
    DEPLOY_OUTPUT=$(netlify deploy --site aztec-docs-dev --prod)
else    
    PR_URL="$2"                                                                                             INT ✘  17:02:39 
    API_URL="${/github.com/api.github.com}"
    API_URL="${API_URL/pull/repos}"
    API_URL="${API_URL}/files"

    echo "API URL: $API_URL"

    echo "https://api.github.com/repos/AztecProtocol/aztec-packages/pulls/"$2"/files"
    DOCS_CHANGED=$(curl -L -f \
        -H "Accept: application/vnd.github+json" \
        -H "Authorization: Bearer $AZTEC_BOT_COMMENTER_GITHUB_TOKEN" \
        "${API_URL}" | \
        jq '[.[] | select(.filename | startswith("docs/"))] | length > 0')

    if [ "$DOCS_CHANGED" = "false" ]; then
        echo "No docs changed, not deploying"
        exit 0
    fi

    # Regular deploy if the argument is not "master" and docs changed
    DEPLOY_OUTPUT=$(netlify deploy --site aztec-docs-dev)
    UNIQUE_DEPLOY_URL=$(echo "$DEPLOY_OUTPUT" | grep -E "https://.*aztec-docs-dev.netlify.app" | awk '{print $4}')
    echo "Unique deploy URL: $UNIQUE_DEPLOY_URL"

    extract_repo yarn-project /usr/src project
    cd project/src/yarn-project/scripts

    yarn
    UNIQUE_DEPLOY_URL=$UNIQUE_DEPLOY_URL yarn docs-preview
fi
