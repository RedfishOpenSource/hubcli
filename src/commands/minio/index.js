import { createPythonCommand } from '../../core/python-command.js';
import { printMinioResult } from './formatters.js';
import { buildMinioPayload } from './payload.js';
import { connectionOptions, objectListOptions, objectReadOptions, objectWriteOptions } from './shared-options.js';

const numericOptions = [{ name: 'timeout', flags: '--timeout' }];

function pythonCommand(operation, extra = {}) {
  return createPythonCommand(operation, {
    pythonCommand: 'minio',
    buildPayload: buildMinioPayload,
    printResult: printMinioResult,
    numericOptions,
    ...extra
  });
}

const bucketGroup = {
  type: 'group',
  name: 'bucket',
  description: 'Bucket operations.',
  subcommands: [
    pythonCommand('bucket.list', {
      name: 'list',
      description: 'List buckets.',
      sharedOptions: connectionOptions
    }),
    pythonCommand('bucket.stat', {
      name: 'stat',
      description: 'Show bucket details.',
      sharedOptions: connectionOptions,
      arguments: [{ name: 'bucketName', syntax: '<bucketName>', description: 'bucket name' }]
    }),
    pythonCommand('bucket.create', {
      name: 'create',
      description: 'Create a bucket.',
      sharedOptions: connectionOptions,
      arguments: [{ name: 'bucketName', syntax: '<bucketName>', description: 'bucket name' }]
    }),
    pythonCommand('bucket.delete', {
      name: 'delete',
      description: 'Delete an empty bucket.',
      sharedOptions: connectionOptions,
      arguments: [{ name: 'bucketName', syntax: '<bucketName>', description: 'bucket name' }]
    })
  ]
};

const objectGroup = {
  type: 'group',
  name: 'object',
  description: 'Object operations.',
  subcommands: [
    pythonCommand('object.list', {
      name: 'list',
      description: 'List objects in a bucket.',
      sharedOptions: connectionOptions,
      options: objectListOptions,
      arguments: [{ name: 'bucketName', syntax: '<bucketName>', description: 'bucket name' }]
    }),
    pythonCommand('object.stat', {
      name: 'stat',
      description: 'Show object metadata.',
      sharedOptions: connectionOptions,
      arguments: [
        { name: 'bucketName', syntax: '<bucketName>', description: 'bucket name' },
        { name: 'objectKey', syntax: '<objectKey>', description: 'object key' }
      ]
    }),
    pythonCommand('object.get', {
      name: 'get',
      description: 'Download an object to a local file.',
      sharedOptions: connectionOptions,
      options: objectReadOptions,
      arguments: [
        { name: 'bucketName', syntax: '<bucketName>', description: 'bucket name' },
        { name: 'objectKey', syntax: '<objectKey>', description: 'object key' }
      ]
    }),
    pythonCommand('object.put', {
      name: 'put',
      description: 'Upload a local file as an object.',
      sharedOptions: connectionOptions,
      options: objectWriteOptions,
      arguments: [
        { name: 'bucketName', syntax: '<bucketName>', description: 'bucket name' },
        { name: 'objectKey', syntax: '<objectKey>', description: 'object key' }
      ]
    }),
    pythonCommand('object.delete', {
      name: 'delete',
      description: 'Delete an object.',
      sharedOptions: connectionOptions,
      arguments: [
        { name: 'bucketName', syntax: '<bucketName>', description: 'bucket name' },
        { name: 'objectKey', syntax: '<objectKey>', description: 'object key' }
      ]
    })
  ]
};

export default {
  type: 'group',
  name: 'minio',
  description: 'MinIO bucket and object operations.',
  subcommands: [
    pythonCommand('ping', {
      name: 'ping',
      description: 'Check MinIO connectivity.',
      sharedOptions: connectionOptions
    }),
    bucketGroup,
    objectGroup
  ]
};
