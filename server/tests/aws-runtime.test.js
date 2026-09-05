'use strict';
const { lambdaClientIp } = require('../aws-runtime');
const req = (address, context) => ({socket:{remoteAddress:address},headers:{'x-amzn-request-context':context},ip:address});
test('local hosting never trusts a client-supplied Lambda context', () => {
  expect(lambdaClientIp(req('203.0.113.9',JSON.stringify({http:{sourceIp:'198.51.100.7'}})),{})).toBe('203.0.113.9');
});
test('Lambda uses adapter context rather than forwarded headers or loopback', () => {
  const request=req('127.0.0.1',JSON.stringify({http:{sourceIp:'198.51.100.7'}}));
  request.headers['x-forwarded-for']='192.0.2.99';
  expect(lambdaClientIp(request,{AWS_LAMBDA_FUNCTION_NAME:'agenda'})).toBe('198.51.100.7');
});
test('malformed or non-loopback Lambda context fails closed to the socket IP', () => {
  expect(lambdaClientIp(req('127.0.0.1','{'),{AWS_LAMBDA_FUNCTION_NAME:'agenda'})).toBe('127.0.0.1');
  expect(lambdaClientIp(req('203.0.113.9',JSON.stringify({http:{sourceIp:'198.51.100.7'}})),{AWS_LAMBDA_FUNCTION_NAME:'agenda'})).toBe('203.0.113.9');
});
