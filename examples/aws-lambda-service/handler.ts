/* eslint-disable @typescript-eslint/quotes */
import {
  Handler,
  APIGatewayProxyResult,
  APIGatewayProxyEventV2WithRequestContext,
  Context,
} from 'aws-lambda';
import { rulesMachineFactory } from './lib';
import { RulesCallback } from './lib/types';
import appRules from './rules/app-rules';

const rulesMachine: Record<keyof typeof appRules, RulesCallback> =
  rulesMachineFactory(appRules);

const ruleNames = Object.keys(rulesMachine);

export const rules: Handler<
  APIGatewayProxyEventV2WithRequestContext<Context>,
  APIGatewayProxyResult
> = async (event) => {
  const { body, pathParameters, rawPath } = event;
  if (rawPath.length <= 1) return helpInfo();
  if (!checkPayload(body)) return { statusCode: 400, body: 'Invalid body' };

  const ruleName = pathParameters?.namedRule;
  if (!ruleName || !ruleNames.includes(ruleName)) {
    return {
      body: `Invalid rule name: ${ruleName}. Valid rule names are:<br/>\n/${ruleNames.join(
        ', /',
      )}`,
      statusCode: 400,
      headers: { 'content-type': 'text/html', 'cache-control': 'no-cache' },
    };
  }

  let result: unknown;
  try {
    const input = body ? JSON.parse(body) : {};
    result = rulesMachine[ruleName](input);
    console.log('input', input);
    console.log('result', result);
  } catch (error) {
    console.error(error);
    return {
      body: `Error running rule: ${ruleName}. Error: ${error.message}`,
      statusCode: 500,
    };
  }

  return {
    body: JSON.stringify(result),
    statusCode: 200,
    headers: {
      'x-rule-name': ruleName,
      'content-type': 'application/json',
    },
  };
};

const helpInfo = () => ({
  body: `<html>
  <head>
    <title>Example Rules Engine Service</title>
  </head>
  <body>
    <h1>Welcome to a Rules Service</h1>
    <p>Try POST to the following endpoints:<br/>\n/${Object.keys(
      rulesMachine,
    ).join('<br/>\n/')}
    </p>
   </body>
  </html>`,
  statusCode: 200,
  headers: { 'content-type': 'text/html', 'cache-control': 'no-cache' },
});

const checkPayload = (body: unknown) => {
  if (!body) throw Error('No body provided');
  if (typeof body !== 'string') throw Error('Body is not a string');
  if (body.length > 10_000) throw Error('Body exceeded 10,000 characters');
  return true;
};
