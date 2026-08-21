import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(path, "utf8");

test("campaign hooks do not talk to Supabase directly", async () => {
  const hook = await read("src/hooks/useCampaigns.tsx");

  assert.doesNotMatch(hook, /@\/integrations\/supabase\/client/);
  assert.doesNotMatch(hook, /supabase\.(from|functions)/);
  assert.match(hook, /@\/features\/headhunting\/data\/campaignRepository/);
});

test("headhunting repository owns campaign and candidate persistence", async () => {
  const repository = await read(
    "src/features/headhunting/data/campaignRepository.ts",
  );

  assert.match(repository, /@\/integrations\/supabase\/client/);
  assert.match(repository, /\.from\("campaigns"\)/);
  assert.match(repository, /\.from\("candidates"\)/);
  assert.match(repository, /listCampaignsForUser/);
  assert.match(repository, /createCampaignRecord/);
  assert.match(repository, /updateCampaignRecord/);
  assert.match(repository, /deleteCampaignRecord/);
  assert.match(repository, /insertCandidateRecords/);
});

test("campaign detail reads through the repository boundary", async () => {
  const hook = await read("src/hooks/useCampaigns.tsx");

  assert.match(hook, /getCampaignRecord\(campaignId\)/);
  assert.match(hook, /listCandidatesForCampaign\(campaignId\)/);
});
