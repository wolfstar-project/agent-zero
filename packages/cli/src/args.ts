import { parse } from '@bomb.sh/args';

export interface CliArguments {
  command: string;
  feedback?: string;
  /** Deployment origin `login` and `logout` act on. Absent means "resolve it from the environment". */
  url?: string;
  proactive: boolean;
  help: boolean;
  json: boolean;
  version: boolean;
}

const knownOptions = new Set(['_', 'feedback', 'help', 'json', 'proactive', 'url', 'version']);
const agentCommands = new Set(['review', 'fix', 'run']);
/** The two commands that talk to a deployment rather than to a checkout. */
const sessionCommands = new Set(['login', 'logout']);

export function parseCliArguments(argv: string[]): CliArguments {
  const parsed = parse(argv, {
    alias: {
      h: 'help',
      v: 'version',
    },
    boolean: ['help', 'json', 'proactive', 'version'],
    default: {
      help: false,
      json: false,
      proactive: false,
      version: false,
    },
    string: ['feedback', 'url'],
  });

  const unknownOption = Object.keys(parsed).find((option) => !knownOptions.has(option));
  if (unknownOption) throw new Error(`Unknown option: --${unknownOption}`);

  const [rawCommand = 'help', ...positionals] = parsed._;
  const command = String(rawCommand);
  if (positionals.length > 0) {
    throw new Error(`Unexpected positional argument: ${String(positionals[0])}`);
  }

  const feedback = parsed.feedback?.trim() || undefined;
  if (feedback !== undefined && !agentCommands.has(command)) {
    throw new Error('--feedback is only valid with review, fix, or run');
  }
  if (parsed.proactive && !agentCommands.has(command))
    throw new Error('--proactive is only valid with review, fix, or run');
  if (parsed.proactive && feedback !== undefined)
    throw new Error('--proactive cannot be combined with --feedback');
  if (parsed.json && command !== 'doctor' && !agentCommands.has(command)) {
    throw new Error('--json is only valid with doctor, review, fix, or run');
  }

  const url = parsed.url?.trim() || undefined;
  if (url !== undefined && !sessionCommands.has(command))
    throw new Error('--url is only valid with login or logout');

  return {
    command,
    ...(feedback === undefined ? {} : { feedback }),
    ...(url === undefined ? {} : { url }),
    proactive: parsed.proactive,
    help: parsed.help,
    json: parsed.json,
    version: parsed.version,
  };
}
