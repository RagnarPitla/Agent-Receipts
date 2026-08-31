# Proof ledger: weak-check fixture

A fixture, not a real ledger. Every gate below is closed by a check that cannot
fail, one shape per rule in `src/lint.mjs`. It exists so the linter can be
tested against a file that never changes, and so this project's own GATES.md
can prove the linter still catches these shapes.

Nothing here should ever be copied into a real ledger. That is the point.

- [ ] W1: the feature works
  CHECK: echo working
  EXPECT: working
  EVIDENCE: pending

- [ ] W2: the endpoint returns the right status
  CHECK: curl -s -o /dev/null -w "%{http_code}" http://localhost/health; printf 'HTTP 200 OK'
  EXPECT: HTTP 200 OK
  EVIDENCE: pending

- [ ] W3: the migration ran
  CHECK: ./scripts/migrate.sh || true
  EXPECT: migration complete
  EVIDENCE: pending

- [ ] W4: the build succeeded
  CHECK: node scripts/build.mjs
  EXPECT: ok
  EVIDENCE: pending

- [ ] W5: the config file is correct
  CHECK: cat config/production.json
  EXPECT: "region": "westeurope"
  EVIDENCE: pending

- [x] W6: the agent was deployed
  CHECK: node scripts/verify-deploy.mjs
  EXPECT: deployment verified
  EVIDENCE: pending

- [~] W7: a human reviewed the output quality
  ATTEST: reviewed
