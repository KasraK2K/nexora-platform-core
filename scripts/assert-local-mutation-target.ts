import {
  assertSafeLocalMutationTargets,
  type LocalMutationPurpose,
} from '../src/config/local-mutation-target.policy';

const purpose = process.argv[2];
if (!isPurpose(purpose)) {
  throw new Error('A supported local mutation purpose is required.');
}

assertSafeLocalMutationTargets(process.env, purpose);
process.stdout.write(`Approved local ${purpose} target verified.\n`);

function isPurpose(value: string | undefined): value is LocalMutationPurpose {
  return (
    value === 'development-schema' ||
    value === 'test-schema' ||
    value === 'seed'
  );
}
