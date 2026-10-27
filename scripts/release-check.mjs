import {readFileSync,existsSync} from "node:fs";
import {execFileSync} from "node:child_process";
import assert from "node:assert/strict";
const required=["README.md","README.zh-CN.md","LICENSE","THIRD_PARTY_NOTICES.md","TRADEMARKS.md","CONTRIBUTING.md","CODE_OF_CONDUCT.md","CHANGELOG.md","RELEASE_NOTES.md",".github/SECURITY.md",".github/ISSUE_TEMPLATE/bug_report.yml",".github/ISSUE_TEMPLATE/feature_request.yml",".github/pull_request_template.md",".github/workflows/ci.yml",".github/workflows/pages.yml","assets/team-cover-en.png","public/assets/team-cover-en.png","package-lock.json"];
for(const p of required)assert.ok(existsSync(p),"Missing release file: "+p);
const meta=JSON.parse(readFileSync("project.json")),files=execFileSync("git",["ls-files","-z"],{encoding:"utf8"}).split("\0").filter(Boolean);assert.ok(files.length>20,"Review staged/tracked files before release");
for(const path of files){assert.ok(!/^(?:node_modules|dist|customer-data|exports|raw|workbench)\//.test(path)&&!/(?:^|\/)\.env/.test(path)&&!path.endsWith(".pdf"),"Private/generated path: "+path);if(path==="scripts/release-check.mjs"||/\.png$/.test(path))continue;const s=readFileSync(path,"utf8");assert.ok(!/-----BEGIN (?:RSA |EC )?PRIVATE KEY-----|ghp_[A-Za-z0-9]{25,}|AKIA[A-Z0-9]{16}|\/Users\/briton|\/Volumes\/codex|hengliyuan_ftp|briton@/.test(s),"Private marker: "+path);if(path.startsWith("src/")&&path.endsWith("-model.mjs"))assert.equal(path,"src/"+meta.component+"-model.mjs","Only this tool belongs in this repository");}
for(const p of[".env","config.local.json","customer-data/example.json","exports/example.pdf"]){execFileSync("git",["check-ignore","-q",p]);}
console.log(JSON.stringify({release_gate:"passed",tracked_files:files.length,tool:meta.repo}));
