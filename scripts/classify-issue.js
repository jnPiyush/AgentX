#!/usr/bin/env node
'use strict';

function classifyIssue(title, body = '') {
  const normalized = String(title).toLowerCase();
  const combined = `${normalized} ${String(body).toLowerCase()}`;
  let type = 'type:story';
  let route = 'Engineer';

  if (/\[bug\]|\bbug:|\b(fix|broken|crash|error|fail|failing|regression|timeout|incorrectly|bypass|does not|doesn't)\b/.test(normalized)) {
    type = 'type:bug';
  } else if (/\[epic\]|\bepic:|\b(complete|end-to-end)\b.*\bsystem\b|\bacross all\b/.test(normalized)) {
    type = 'type:epic';
    route = 'Product Manager';
  } else if (/\[feature\]|\bfeature:|\b(new sidebar|sidebar panel|new capability)\b/.test(normalized)) {
    type = 'type:feature';
    route = 'Architect';
  } else if (/\[spike\]|\bspike:|\b(investigate|research|assess|evaluate|explore|analysis)\b/.test(normalized)) {
    type = 'type:spike';
    route = 'Architect';
  } else if (/\[devops\]|\bdevops:|\b(pipeline|deploy|deployment|release|ci|ci\/cd|github actions|workflow)\b/.test(normalized)) {
    type = 'type:devops';
    route = 'DevOps Engineer';
  } else if (/\[docs\]|\bdocs:|\b(readme|guide|document|documentation|docs?)\b/.test(normalized)) {
    type = 'type:docs';
  } else if (/\[test\]|\b(testing:|certification|end-to-end|e2e|playwright|test suite|test automation|write tests?)\b/.test(normalized)) {
    type = 'type:testing';
    route = 'Tester';
  } else if (/\b(power\s*bi|dax|semantic model|report|dashboard)\b/.test(normalized)) {
    type = 'type:powerbi';
    route = 'Power BI Analyst';
  } else if (/\b(train|training|fine-tun|classifier|machine learning|data science|data-science|model drift)\b/.test(normalized)) {
    type = 'type:data-science';
    route = 'Data Scientist';
  }

  const domains = [];
  if (/\b(ai|llm|genai|agent|rag|embedding)\b/.test(combined)) {
    domains.push('needs:ai');
  }
  if (/\b(ux|wireframe|prototype|design)\b/.test(combined)) {
    domains.push('needs:ux');
  }
  return { type, route, domains };
}

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? '' : '';
}

if (require.main === module) {
  const result = classifyIssue(readArgument('--title'), readArgument('--body'));
  if (process.argv.includes('--github-output')) {
    process.stdout.write(`type=${result.type}\nroute=${result.route}\ndomains=${result.domains.join(' ')}\n`);
  } else {
    process.stdout.write(`${JSON.stringify(result)}\n`);
  }
}

module.exports = { classifyIssue };