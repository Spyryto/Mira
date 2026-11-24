import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const compiler = fileURLToPath(new URL('../dist/mira.cjs', import.meta.url));
const sample = readFileSync(new URL('../examples/arithmetic.mira', import.meta.url), 'utf8');

function withSource(source, fn) {
  const directory = mkdtempSync(join(tmpdir(), 'mira-'));
  try {
    const path = join(directory, 'example.mira');
    writeFileSync(path, source);
    return fn(path, directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function compile(source, target) {
  return withSource(source, path => execFileSync(
    'node', [compiler, path, target], { encoding: 'utf8' }
  ));
}

function compileError(source, target = 'js') {
  return withSource(source, path => spawnSync(
    'node', [compiler, path, target], { encoding: 'utf8' }
  ));
}

function run(source, target) {
  return withSource(source, (path, directory) => {
    const generated = execFileSync(
      'node', [compiler, path, target], { encoding: 'utf8' }
    );
    const extension = target === 'js' ? 'mjs' : 'php';
    const outputPath = join(directory, 'program.' + extension);
    const suffix = target === 'js'
      ? '\nconsole.log(JSON.stringify(result));\n'
      : '\necho json_encode($result), "\\n";\n';

    writeFileSync(outputPath, generated + suffix);
    return execFileSync(target === 'js' ? 'node' : 'php',
      [outputPath], { encoding: 'utf8' }).trim();
  });
}

test('full and abbreviated selectors have one canonical host name', () => {
  const generated = compile(sample, 'js');
  assert.match(generated, /function add__and\(aNumber, anotherNumber\)/);
  assert.match(generated, /const two = add__and\(1, 1\);/);
  assert.match(generated, /const six = add__and\(3, 3\);/);
  assert.match(generated, /const seven = add__and\(two, five\);/);
});

test('the same program runs on JavaScript and PHP', () => {
  for (const target of ['js', 'php']) {
    assert.equal(run(sample, target), '49');
  }
});

test('multiword arguments are preserved in parenthesized shorthand', () => {
  const source = [
    'add: a number, and: another number = a number + another number;',
    'copy add: a number, and: another number = add (a number) and (another number);',
    'result = copy add 2 and 3;'
  ].join('\n');

  for (const target of ['js', 'php']) {
    assert.equal(run(source, target), '5');
    const expected = target === 'php'
      ? /add__and\(\$aNumber, \$anotherNumber\)/
      : /add__and\(aNumber, anotherNumber\)/;
    assert.match(compile(source, target), expected);
  }
});

test('selector resolution is independent of declaration order', () => {
  assert.equal(run('result = add 2 and 3; add: a, and: b = a + b;', 'js'), '5');
});

test('abbreviated calls reject bare multiword variable arguments', () => {
  const source = 'add: a number, and: another number = a number + another number; result = add a number and another number;';
  const outcome = compileError(source);
  assert.notEqual(outcome.status, 0);
});

test('an unknown selector is not inferred or guessed', () => {
  const outcome = compileError('result = add 2 and 3;');
  assert.notEqual(outcome.status, 0);
  assert.match(outcome.stderr, /Unknown identifier/);
});

test('invalid characters have line-and-column diagnostics', () => {
  const outcome = compileError('result = @;');
  assert.notEqual(outcome.status, 0);
  assert.match(outcome.stderr, /1:10/);
});

test('mangled names cannot collide', () => {
  const outcome = compileError('a b = 1; aB = 2;');
  assert.notEqual(outcome.status, 0);
  assert.match(outcome.stderr, /collision/);
});

test('operators are left-associative without arithmetic precedence', () => {
  assert.equal(run('result = 1 + 2 * 3;', 'js'), '9');
  assert.equal(run('result = 1 + (2 * 3);', 'php'), '7');
});

test('each definition needs a semicolon', () => {
  const outcome = compileError('result = 1');
  assert.notEqual(outcome.status, 0);
  assert.match(outcome.stderr, /Expected ;/);
});

test('token inspection retains source positions', () => {
  const tokens = JSON.parse(compile('result = 5;\n', '--tokens'));
  assert.deepEqual(
    tokens.slice(0, 3).map(t => [t.kind, t.value, t.line, t.column]),
    [
      ['Word', 'result', 1, 1],
      ['Symbol', '=', 1, 8],
      ['Number', '5', 1, 10]
    ]
  );
});

test('duplicate function parameters are rejected', () => {
  const outcome = compileError('add: x, and: x = x + x;');
  assert.notEqual(outcome.status, 0);
  assert.match(outcome.stderr, /Duplicate parameter/);
});

test('CLI rejects an unknown target at its external boundary', () => {
  const outcome = compileError('result = 1;', 'ruby');
  assert.notEqual(outcome.status, 0);
  assert.match(outcome.stderr, /Unknown target: ruby/);
});

test('in-process benchmark reports valid timing metrics for both enum targets', () => {
  for (const target of ['js', 'php']) {
    const report = withSource('result = 2 + 3;', path => {
      const stdout = execFileSync(
        'node', [compiler, '--benchmark', path, target, '12'],
        { encoding: 'utf8' }
      );
      return JSON.parse(stdout);
    });

    assert.equal(report.target, target);
    assert.equal(report.iterations, 12);
    assert.ok(report.medianMs >= 0);
    assert.ok(report.p95Ms >= report.medianMs);
    assert.ok(report.generatedBytes > 0);
  }
});

test('benchmark rejects invalid sample counts', () => {
  const outcome = withSource('result = 1;', path => spawnSync(
    'node', [compiler, '--benchmark', path, 'js', '0'],
    { encoding: 'utf8' }
  ));
  assert.notEqual(outcome.status, 0);
  assert.match(outcome.stderr, /iterations/);
});


const sectionExample = readFileSync(
  new URL('../examples/sections.mira', import.meta.url), 'utf8'
);

test('keyword sections and pipeline work on JS and PHP', () => {
  for (const target of ['js', 'php']) {
    assert.equal(run(sectionExample, target), '10');
    const generated = compile(sectionExample, target);
    assert.match(generated, /add__and/);
    assert.match(generated, /__miraSection/);
  }
});

test('a named section can be used as a first-class unary function', () => {
  const source = [
    'add: left, and: right = left + right;',
    'increment = (add: _, and: 1);',
    'result = 5 >> increment;'
  ].join('\n');

  for (const target of ['js', 'php']) {
    assert.equal(run(source, target), '6');
  }
});

test('two placeholder slots create a real two-argument function', () => {
  const source = [
    'add: left, and: right = left + right;',
    'adder = (add: _, and: _);',
    'result = 0;'
  ].join('\n');

  for (const target of ['js', 'php']) {
    const generated = compile(source, target);
    withSource(source, (_, directory) => {
      const extension = target === 'js' ? 'mjs' : 'php';
      const file = join(directory, 'section.' + extension);
      const invocation = target === 'js'
        ? '\nconsole.log(adder(8, 9));\n'
        : '\necho $adder(8, 9), "\n";\n';
      writeFileSync(file, generated + invocation);
      const output = execFileSync(
        target === 'js' ? 'node' : 'php', [file], {encoding: 'utf8'}
      ).trim();
      assert.equal(output, '17');
    });
  }
});

test('selector section captures an outer parameter on JS and PHP', () => {
  const source = [
    'add: left, and: right = left + right;',
    'add by: amount = (add: _, and: amount);',
    'result = 5 >> (add by: 4);'
  ].join('\n');

  for (const target of ['js', 'php']) {
    assert.equal(run(source, target), '9');
  }
});

test('section arguments are hygienic even if a user name resembles an internal name', () => {
  const source = [
    'add: left, and: right = left + right;',
    '__miraSection0 = 99;',
    'increment = (add: _, and: __miraSection0);',
    'result = 1 >> increment;'
  ].join('\n');

  for (const target of ['js', 'php']) {
    assert.equal(run(source, target), '100');
  }
});

test('pipeline operators group left to right with numeric arithmetic', () => {
  const source = [
    'add: left, and: right = left + right;',
    'result = 1 + 2 >> (add: _, and: 4);'
  ].join('\n');

  for (const target of ['js', 'php']) {
    assert.equal(run(source, target), '7');
  }
});

test('pipeline refuses direct multi-hole sections', () => {
  const source = [
    'add: left, and: right = left + right;',
    'result = 5 >> (add: _, and: _);'
  ].join('\n');

  const outcome = compileError(source);
  assert.notEqual(outcome.status, 0);
  assert.match(outcome.stderr, /unary section/);
});

test('unbound and isolated placeholders fail with a clear diagnostic', () => {
  const snippets = [
    'result = _;',
    'result = (_);'
  ];

  for (const snippet of snippets) {
    const outcome = compileError(snippet);
    assert.notEqual(outcome.status, 0);
    assert.match(outcome.stderr, /Placeholder/);
  }
});

test('pipeline rejects an obviously non-callable literal', () => {
  const outcome = compileError('result = 5 >> 3;');
  assert.notEqual(outcome.status, 0);
  assert.match(outcome.stderr, /Pipeline target/);
});

test('underscore cannot be declared as a value or parameter', () => {
  for (const source of [
    '_ = 1;',
    'add: _, and: value = value;'
  ]) {
    const outcome = compileError(source);
    assert.notEqual(outcome.status, 0);
    assert.match(outcome.stderr, /reserved/);
  }
});


test('structured-data literals reject duplicate keys and malformed delimiters', () => {
  for (const [source, diagnostic] of [
    ['result = {name: "A", name: "B"};', 'Duplicate record key'],
    ['result = [1, 2,];', 'Trailing comma in list'],
    ['result = {name: 1,};', 'Trailing comma in record'],
    ['result = [1, 2;', 'Unclosed delimiter'],
    ['result = {name: 1];', 'Unmatched closing delimiter']
  ]) {
    const outcome = compileError(source);
    assert.notEqual(outcome.status, 0, source);
    assert.match(outcome.stderr, new RegExp(diagnostic), source);
  }
});

test('native field accessors are first-class callable values on both targets', () => {
  const source = [
    'hours = field "hours";',
    'lesson = {hours: 1.5};',
    'result = lesson >> hours;'
  ].join('\n');
  for (const target of ['js', 'php']) {
    assert.equal(run(source, target), '1.5');
    const generated = compile(source, target);
    assert.doesNotMatch(generated, /__miraHost/);
  }
});

test('Mira conditions are lazy on JS and PHP', () => {
  const source = [
    'result = if: (false),',
    '  then: (({value: 1} ~ missing)),',
    '  else: (if: (2 > 1), then: (42), else: (0));'
  ].join('\n');
  for (const target of ['js', 'php']) {
    assert.equal(run(source, target), '42');
  }
});

test('Mira compares scalar values and has native booleans', () => {
  const source = 'result = (true == (3 >= 2)) == ("a" != "b");';
  for (const target of ['js', 'php']) {
    assert.equal(run(source, target), 'true');
    assert.match(compile(source, target), /===/);
  }
});

test('functions capture global values with parameter names shadowing them', () => {
  const source = [
    'bonus = 10;',
    'pay: hours = hours * 20 + bonus;',
    'result = pay: 2;'
  ].join('\n');
  for (const target of ['js','php']) assert.equal(run(source,target),'50');

  const shadow = [
    'value = 100;',
    'increment: value = value + 1;',
    'result = increment: 2;'
  ].join('\n');
  for (const target of ['js','php']) assert.equal(run(shadow,target),'3');
});

test('malformed native conditional has a diagnostic instead of an implicit selector match', () => {
  const snippets = [
    'result = if: true, then: (1), else: (2);',
    'result = if: (true), then: (1);'
  ];
  for (const source of snippets) {
    const outcome = compileError(source);
    assert.notEqual(outcome.status,0,source);
    assert.match(outcome.stderr,/parenthesized|Expected else/);
  }
});

test('missing field access is rejected consistently at runtime', () => {
  const source = 'result = {score: 1} ~ age;';
  withSource(source,(file,dir)=>{
    for(const target of ['js','php']){
      const generated=execFileSync('node',[compiler,file,target],{encoding:'utf8'});
      const output=join(dir,'missing.'+(target==='js'?'mjs':'php'));
      writeFileSync(output,generated+'\n'+(target==='js'?'console.log(result);':'echo $result;'));
      const response=spawnSync(target==='js'?'node':'php',[output],{encoding:'utf8'});
      assert.notEqual(response.status,0,target);
      assert.match(response.stderr,/Missing record field: age/);
    }
  });
});


test('0.5 operator sections are first-class unary functions on JS and PHP', () => {
  for (const [source, expected] of [
    ['result = 7 >> (_ > 5);', 'true'],
    ['result = 3 >> (10 - _);', '7'],
    ['result = 5 >> (_ * 2);', '10'],
    ['accept: predicate = 8 >> predicate; result = accept: (_ >= 7);', 'true'],
    ['threshold = 3; result = 7 >> (_ > threshold);', 'true'],
    ['result = 3 >> (_ != 4);', 'true']
  ]) {
    for (const target of ['js', 'php']) {
      assert.equal(run(source, target), expected, source + ' / ' + target);
    }
  }
});

test('operator sections support two holes but pipelines require one', () => {
  const source = 'sum = (_ + _); result = 0;';
  withSource(source, (path, dir) => {
    for (const target of ['js', 'php']) {
      const output = execFileSync('node', [compiler, path, target], {encoding:'utf8'});
      const filename = join(dir, 'section.' + (target==='js' ? 'mjs' : 'php'));
      writeFileSync(filename, output + (target==='js'
        ? '\nconsole.log(sum(3, 4));'
        : '\necho $sum(3, 4);'));
      assert.equal(execFileSync(target==='js' ? 'node' : 'php',
        [filename], {encoding:'utf8'}).trim(), '7');
    }
  });
  const invalid = compileError('result = 4 >> (_ + _);');
  assert.notEqual(invalid.status, 0);
  assert.match(invalid.stderr, /unary operator section/);
  const bare = compileError('result = _ + 1;');
  assert.notEqual(bare.status, 0);
  assert.match(bare.stderr, /Placeholder/);
});

// Mira 0.6 gives field reading and function application separate AST semantics.
test('0.6 static record fields, shadowed names and chained keys on JS/PHP', () => {
  for (const [source, expected] of [
    ['lesson = {hours: 2, rate: 30}; result = lesson ~ hours;', '2'],
    ['hours = 999; lesson = {hours: 2}; result = lesson ~ hours;', '2'],
    ['student = {address: {city: "Padova"}}; result = student ~ address ~ city;', '"Padova"'],
    ['lesson = {"total hours": 3}; result = lesson ~ "total hours";', '3'],
    ['lesson = {hours: 2}; result = lesson >> (_ ~ hours);', '2'],
    ['result = 5 >> (_ * 2) >> (_ + 1);', '11'],
    ['hours = field "hours"; lesson = {hours: 2}; result = lesson >> hours;', '2']
  ]) for (const target of ['js','php']) {
    assert.equal(run(source,target), expected, source+' / '+target);
  }
});

test('0.6 rejects invalid field targets and reserves complex holes for blocks', () => {
  for (const [source, expected] of [
    ['result = 5 ~ (_ + 1);', /Expected a field name after ~/],
    ['result = 1 ~ 2;', /Expected a field name after ~/],
    ['result = {hours: 2} >> (_ ~ hours >= 1);', /Complex placeholders require blocks/],
    ['result = 5 >> (_ + _);', /unary operator section/]
  ]) {
    const failed = compileError(source);
    assert.notEqual(failed.status, 0, source);
    assert.match(failed.stderr, expected, source);
  }
});

test('multiword record fields need no quotes after ~ on JS and PHP', () => {
  const cases = [
    ['lesson = {"total hours": 3}; result = lesson ~ total hours;', '3'],
    ['lesson = {"total hours": 3}; result = lesson ~ "total hours";', '3'],
    ['student = {address: {"postal code": "30032"}}; result = student ~ address ~ postal code;', '"30032"'],
    ['lesson = {"total hours": 3}; result = lesson ~ total hours + 2;', '5'],
    ['lesson = {"total hours": 3}; result = (lesson ~ total hours) * 2;', '6'],
    ['lesson = {"total hours": 3}; result = lesson ~ total hours >> (_ + 1);', '4'],
    ['lesson = {"total hours": 3}; result = lesson >> (_ ~ total hours);', '3'],
    ['hourly rate = 30; hours = 2; pay = hourly rate * hours; result = pay;', '60'],
    ['total hours = 99; lesson = {"total hours": 3}; result = lesson ~ total hours;', '3']
  ];
  for (const [source, expected] of cases) {
    for (const target of ['js', 'php']) {
      assert.equal(run(source, target), expected, source + ' / ' + target);
    }
  }
});

test('multiword fields keep a checked missing-key error', () => {
  const source = 'result = {hours: 3} ~ total hours;';
  withSource(source, (path, directory) => {
    for (const target of ['js', 'php']) {
      const generated = execFileSync('node', [compiler, path, target], {encoding: 'utf8'});
      const output = join(directory, 'missing-field.' + (target === 'js' ? 'mjs' : 'php'));
      writeFileSync(output, generated);
      const response = spawnSync(target === 'js' ? 'node' : 'php', [output], {encoding: 'utf8'});
      assert.notEqual(response.status, 0);
      assert.match(response.stderr, /Missing record field: total hours/);
    }
  });
});
