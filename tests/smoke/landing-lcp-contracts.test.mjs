import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const hero = readFileSync("src/components/landing/HeroSection.tsx", "utf8");

test("landing LCP heading and summary are visible without animation delay", () => {
  assert.match(hero, /<h1[\s\S]*?{heroTitle}[\s\S]*?<\/h1>/);
  assert.match(hero, /<p[\s\S]*?{heroSubtitle}[\s\S]*?<\/p>/);
  assert.doesNotMatch(
    hero,
    /<motion\.(?:h1|p)[\s\S]*?initial=\{\{\s*opacity:\s*0/,
  );
});

test("non-critical landing motion remains decorative and outside the LCP copy", () => {
  assert.match(hero, /\{\/\* CTA Buttons \*\/\}[\s\S]*?<motion\.div/);
  assert.match(hero, /\{\/\* Floating Elements \*\/\}[\s\S]*?<motion\.div/);
});
