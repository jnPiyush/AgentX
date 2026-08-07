#!/usr/bin/env node
'use strict';

function classifyIssue(title, body = '') {
  const normalized = String(title).toLowerCase();
  const combined = `${normalized} ${String(body).toLowerCase()}`;
  const fabricIntent = /\b(microsoft fabric|fabric|lakehouse|onelake|dataflow gen2|fabric warehouse|fabric pipeline|fabric notebook|fabric data agent)\b/.test(combined);
  const powerPlatformIntent = /\b(power platform|power apps|power automate|power pages|dataverse|power fx|pcf control|copilot studio)\b/.test(combined);
  const powerBiIntent = /\b(power\s*bi|dax|pbip|tmdl|semantic model|report|dashboard)\b/.test(combined);
  const dataScienceIntent = /\b(forecast|forecasting|model evaluation|evaluate model|machine learning|data science|data-science|model drift|train|training|fine-tun)\b/.test(combined);
  let type = 'type:story';
  let route = 'Engineer';

  if (/\[bug\]|\bbug:/.test(normalized)) {
    type = 'type:bug';
  } else if (/\[epic\]|\bepic:/.test(normalized)) {
    type = 'type:epic';
    route = 'Product Manager';
  } else if (/\[spike\]|\bspike:/.test(normalized)) {
    type = 'type:spike';
    route = 'Architect';
  } else if (/\[devops\]|\bdevops:/.test(normalized)) {
    type = 'type:devops';
    route = 'DevOps Engineer';
  } else if (/\[docs\]|\bdocs:/.test(normalized)) {
    type = 'type:docs';
  } else if (/\[test\]|\btesting:/.test(normalized)) {
    type = 'type:testing';
    route = 'Tester';
  } else if (powerBiIntent) {
    type = 'type:powerbi';
    route = 'Power BI Analyst';
  } else if (fabricIntent && dataScienceIntent) {
    type = 'type:data-science';
    route = 'Data Scientist';
  } else if (fabricIntent) {
    type = 'type:fabric';
    route = 'Fabric Engineer';
  } else if (powerPlatformIntent) {
    type = 'type:lowcode';
    route = 'Power Platform Builder';
  } else if (/\[feature\]|\bfeature:/.test(normalized)) {
    type = 'type:feature';
    route = 'Architect';
  } else if (/\b(fix|broken|crash|error|fail|failing|regression|timeout|incorrectly|bypass|does not|doesn't)\b/.test(normalized)) {
    type = 'type:bug';
  } else if (/\b(complete|end-to-end)\b.*\bsystem\b|\bacross all\b/.test(normalized)) {
    type = 'type:epic';
    route = 'Product Manager';
  } else if (/\b(new sidebar|sidebar panel|new capability)\b/.test(normalized)) {
    type = 'type:feature';
    route = 'Architect';
  } else if (/\b(investigate|research|assess|evaluate|explore|analysis)\b/.test(normalized)) {
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
  } else if (/\b(classifier|machine learning|data science|data-science|model drift|train|training|fine-tun)\b/.test(normalized)) {
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