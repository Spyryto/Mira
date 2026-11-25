import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
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

test('multiword record declarations and accesses agree on JS and PHP', () => {
  for (const [source, expected] of [
    ['lesson = {total hours: 3}; result = lesson ~ total hours;', '3'],
    ['lesson = { total hours: 3}; result = lesson ~ total hours;', '3'],
    ['lesson = {total hours: 3}; result = lesson ~ "total hours";', '3'],
    ['lesson = {"total hours": 3}; result = lesson ~ total hours;', '3'],
    ['student = {address: {postal code: "30032"}}; result = student ~ address ~ postal code;', '"30032"'],
    ['lesson = {total hours: 3}; result = lesson >> (_ ~ total hours);', '3'],
    ['hourly rate = 30; hours = 2; pay = hourly rate * hours; result = pay;', '60'],
    ['summary = {total hours: 2 + 3, hourly rate: 12}; result = summary ~ total hours;', '5']
  ]) {
    for (const target of ['js','php']) {
      assert.equal(run(source, target), expected, source + ' / ' + target);
    }
  }
});

test('duplicate keys are detected across quoted and bare multiword forms', () => {
  for (const source of [
    'result = {total hours: 3, "total hours": 4};',
    'result = {"total hours": 3, total hours: 4};'
  ]) {
    const failure = compileError(source);
    assert.notEqual(failure.status, 0, source);
    assert.match(failure.stderr, /Duplicate record key total hours/);
  }
});

test('record literal missing colon keeps a clear source diagnostic', () => {
  const failure = compileError('lesson = {total hours 3}; result = 0;');
  assert.notEqual(failure.status, 0);
  assert.match(failure.stderr, /Expected : after record key/);
});

test('natural if then else syntax shares lazy conditional semantics on JS and PHP', () => {
  for (const [source, expected] of [
    ['result = if (1 < 2) then "valid" else "invalid";', '"valid"'],
    ['result = if (1 > 2) then "valid" else "invalid";', '"invalid"'],
    ['result = if (true) then 42 else 0;', '42'],
    ['result = if (false) then 42 else 0;', '0'],
    ['result = if (true) then (1 + 2 * 3) else 0;', '9'],
    ['result = if (false) then ({value: 0} ~ missing) else 7;', '7'],
    ['result = if (true) then 7 else ({value: 0} ~ missing);', '7'],
    ['result = if (true) then (if (false) then "wrong" else "nested") else "outer";', '"nested"'],
    ['result = {label: if (1 < 2) then "valid" else "invalid"};', '{"label":"valid"}'],
    ['hourly rate = 30; result = if (hourly rate > 20) then hourly rate else 10;', '30'],
    ['result = if: (1 < 2), then: ("valid"), else: ("invalid");', '"valid"']
  ]) {
    for (const target of ['js', 'php']) {
      assert.equal(run(source, target), expected, source + ' / ' + target);
    }
  }
});

test('natural conditionals diagnose missing then and else boundaries', () => {
  const invalid = [
    ['result = if (true) 1 else 2;', /Expected then branch/],
    ['result = if (true) then 1;', /Expected else branch/],
    ['result = if (true) then else 2;', /Expected then expression/],
    ['result = if (true) then 1 else;', /Expected else expression/],
    ['result = if (1 < 2) then (1 + 2) else;', /Expected else expression/]
  ];
  for (const [source, diagnostic] of invalid) {
    const error = compileError(source);
    assert.notEqual(error.status, 0, source);
    assert.match(error.stderr, diagnostic, source);
  }
});

test('conditional separators are optional, matching keyword-selector spelling on JS and PHP', () => {
  for (const source of [
    'result = if (1 < 2), then: ("valid"), else: ("invalid");',
    'result = if (1 < 2) then: ("valid") else: ("invalid");',
    'result = if (1 < 2), then ("valid"), else ("invalid");',
    'result = if: (1 < 2) then ("valid") else ("invalid");',
    'result = if: (1 < 2), then: ("valid"), else: ("invalid");',
    'result = if (1 < 2) then "valid" else "invalid";',
    'result = if (1 < 2), then: "valid", else: "invalid";',
    'result = if (1 < 2) then "valid", else "invalid";',
    'result = if (1 < 2), then "valid" else "invalid";',
    'result = if: (1 < 2) then: "valid" else "invalid";'
  ]) {
    for (const target of ['js','php']) {
      assert.equal(run(source, target), '"valid"', source + ' / ' + target);
    }
  }
});

test('conditional comma/colon variants preserve expressions, nesting and laziness', () => {
  for (const [source, expected] of [
    ['result = if (false), then: ({x: 1} ~ missing), else: (42);', '42'],
    ['result = if: (true) then: 42, else: ({x: 1} ~ missing);', '42'],
    ['result = if (true), then: (if (false), then: 1, else: 2), else: 3;', '2'],
    ['result = {answer: if (true), then: (1 + 2), else: 0};', '{"answer":3}'],
    ['result = if (false) then 1 else if (true), then: 5, else: 0;', '5']
  ]) {
    for (const target of ['js','php']) {
      assert.equal(run(source, target), expected, source + ' / ' + target);
    }
  }
});

test('malformed mixed punctuation conditionals keep useful errors', () => {
  for (const [source, expected] of [
    ['result = if (true), else: (4);', /Expected then branch/],
    ['result = if (true), then: (4);', /Expected else branch/],
    ['result = if (true), then: (), else: 4;', /Expected expression/],
    ['result = if (true), then: 4, else:;', /Expected else expression/]
  ]) {
    const failure = compileError(source);
    assert.notEqual(failure.status, 0, source);
    assert.match(failure.stderr, expected, source);
  }
});

test('expression blocks support one parameter, multiword names, records and repeated _ on JS/PHP', () => {
  for (const [source, expected] of [
    ['result = 5 >> {_ | _ * 2};', '10'],
    ['result = 5 >> {value | value * 2};', '10'],
    ['result = 5 >> {_ | _ + _};', '10'],
    ['result = 4 >> {a number | a number + 1};', '5'],
    ['lesson = {hours: 2, rate: 30}; fee = {lesson | (lesson ~ hours) * (lesson ~ rate)}; result = lesson >> fee;', '60'],
    ['lesson = {hours: 2, rate: 30}; fee = {_ | (_ ~ hours) * (_ ~ rate)}; result = lesson >> fee;', '60'],
    ['result = {hours: 2, rate: 30} >> {_ | (_ ~ hours) * (_ ~ rate)};', '60'],
    ['rate = 30; result = 2 >> {hours | hours * rate};', '60'],
    ['hours = 100; result = 2 >> {hours | hours + 1};', '3'],
    ['result = 4 >> {_ | if (_ > 3) then "yes" else "no"};', '"yes"'],
    ['make multiplier: factor = {_ | _ * factor}; result = 5 >> (make multiplier: 3);', '15'],
    ['result = 5 >> {outer | (outer + 1) >> {inner | inner * outer}};', '30'],
    ['result = {key: "value", count: 2} ~ count;', '2']
  ]) {
    for (const target of ['js','php']) {
      assert.equal(run(source,target),expected,source+' / '+target);
    }
  }
});

test('block parameters are locally bound, while unbound variables remain errors', () => {
  for (const [source, expected] of [
    ['result = {_ | missing};', /Unknown identifier|Unbound/],
    ['result = {value | value + unknown};', /Unknown identifier|Unbound/],
    ['result = {value | };', /A block needs at least one expression/],
    ['result = {value | value + 1;; };', /Expected expression/],
    ['result = {__miraHost | 1};', /Reserved block parameter/]
  ]) {
    const error = compileError(source);
    assert.notEqual(error.status,0,source);
    assert.match(error.stderr, expected,source);
  }
});

test('multi-parameter blocks remain distinct from records, preserve closure capture and reject unary pipeline use', () => {
  const success = [
    ['a value = {left: 2, right: 3}; result = a value ~ left;', '2'],
    ['result = 5 >> {_ | _ * 2};', '10'],
    ['result = 10 >> {outer | outer >> {inner | inner + outer}};', '20'],
    ['result = 2 >> {_ | _ + _};', '4'],
    ['result = 5 >> {value | value + 1};', '6']
  ];
  for (const [source, expected] of success)
    for (const target of ['js','php'])
      assert.equal(run(source,target),expected,source+' / '+target);

  const errors = [
    ['result = 5 >> {left, right | left + right};', /Pipeline needs a unary block/],
    ['result = {a, a | a};', /Duplicate or conflicting block parameter/],
    ['result = {a b, aB | a b + aB};', /Duplicate or conflicting block parameter/],
    ['result = {__, __ | __};', /Duplicate or conflicting block parameter/],
    ['result = {__miraHost, value | value};', /Reserved block parameter/],
    ['result = {a, b | a + unknown};', /Unknown identifier|Unbound/],
    ['result = {a, b | a + b;; };', /Expected expression/]
  ];
  for (const [source, diagnostic] of errors) {
    const failure = compileError(source);
    assert.notEqual(failure.status,0,source);
    assert.match(failure.stderr,diagnostic,source);
  }
});

test('~ chains left and binds before every arithmetic operator on JS and PHP', () => {
  const programs = [
    ['lesson = {hours: 2, rate: 30}; result = lesson ~ hours * lesson ~ rate;', '60'],
    ['lesson = {hours: 2, rate: 30}; result = 10 + lesson ~ hours * lesson ~ rate;', '360'],
    ['lesson = {hours: 2, rate: 30}; result = 10 + (lesson ~ hours * lesson ~ rate);', '70'],
    ['lesson = {hours: 2, rate: 30}; result = lesson ~ rate / lesson ~ hours;', '15'],
    ['lesson = {hours: 2, rate: 30}; result = lesson ~ rate - lesson ~ hours;', '28'],
    ['student = {address: {postal code: 30032}}; result = student ~ address ~ postal code;', '30032'],
    ['lesson = {hours: 2, rate: 30}; result = (lesson ~ hours) * (lesson ~ rate);', '60'],
    ['lesson = {hours: 2, rate: 30}; result = lesson ~ hours >= 1;', 'true'],
    ['result = 1 + 2 * 3;', '9'],
    ['result = 2 + (3 * 4);', '14']
  ];
  for (const [source, expected] of programs) {
    for (const target of ['js', 'php']) {
      assert.equal(run(source, target), expected, source + ' / ' + target);
    }
  }
});

test('missing field after ~ reports a diagnostic and bare blocks remain records when appropriate', () => {
  const error = compileError('result = {hours: 2} ~ ;');
  assert.notEqual(error.status, 0);
  assert.match(error.stderr, /Expected a field name after ~/);
  for (const target of ['js','php']) {
    assert.equal(run('result = {hours: 2, rate: 30} ~ rate;',target),'30');
  }
});

test('0.11 blocks evaluate multiple expressions in order and return the last', () => {
  const cases = [
    ['result = 3 >> {x | x + 1; x * 2};', '6'],
    ['result = 3 >> {x | x + 1; x * 2;};', '6'],
    ['result = 5 >> {_ | _ + 1; _ * 2};', '10'],
    ['result = 5 >> {_ | _ + 1;};', '6'],
    ['result = 3 >> {x | x + 1; x * 2; x + 10};', '13'],
    ['rate = 4; result = 3 >> {x | x + rate; x * rate};', '12'],
    ['result = 2 >> {outer | outer + 1; (outer + 1) >> {inner | inner * outer; inner + outer}};', '5'],
    ['factor = 3; make: rate = {value | value + factor; value * rate}; result = 2 >> (make: 4);', '8'],
    ['result = 3 >> {n | if (n > 2) then "ok" else "bad"; n + 1};', '4'],
    ['result = 5 >> {x | x + 1};', '6'],
    ['result = 5 >> {x | x + 1;};', '6']
  ];
  for (const [source, expected] of cases) {
    for (const target of ['js','php'])
      assert.equal(run(source,target),expected,source+' / '+target);
  }
});

test('0.11 block expressions diagnose empty bodies and consecutive delimiters', () => {
  const cases = [
    ['result = {x | };', /A block needs at least one expression/],
    ['result = {x | x + 1;; x * 2};', /Expected expression/],
    ['result = {x | ; x + 1};', /Expected expression/],
    ['result = {x | x + 1; missing};', /Unknown identifier|Unbound/]
  ];
  for (const [source, diagnostic] of cases) {
    const failure = compileError(source);
    assert.notEqual(failure.status,0,source);
    assert.match(failure.stderr,diagnostic,source);
  }
});

test('0.11 evaluates earlier expressions even when their result is discarded', () => {
  const source = 'result = 1 >> {n | {field: 2} ~ missing; n + 1};';
  for (const target of ['js','php']) {
    const generated=compile(source,target);
    assert.ok(generated.includes('Missing record field:'));
    assert.throws(() => run(source,target),/Missing record field/);
  }
});

test('0.12 local values are immutable and visible to following expressions on JS/PHP', () => {
  const cases = [
    ['result = 4 >> {value | doubled = value * 2; doubled + value};', '12'],
    ['rate = 30; result = 2 >> {hours | subtotal = hours * rate; subtotal + 5};', '65'],
    ['result = 3 >> {x | first = x + 1; second = first * 2; second + x};', '11'],
    ['result = 5 >> {x | intermediate = x + 1; intermediate * 2;};', '12'],
    ['result = 2 >> {x | local = x + 1; local >> {y | y + local}};', '6'],
    ['result = 4 >> {x | local = x + 1; local >> {y | next = y + 1; next + local}};', '11'],
    ['factor = 3; result = 4 >> {x | total = x * factor; total >> {y | y + factor}};', '15'],
    ['result = 4 >> {x | local = x + 1; x >> {local | local + x}};', '8'],
    ['result = 3 >> {x | a value = x * 2; a value + 1};', '7'],
    ['result = 3 >> {x | flag = x > 2; if (flag) then "yes" else "no"};', '"yes"']
  ];
  for (const [source, expected] of cases)
    for (const target of ['js','php'])
      assert.equal(run(source,target),expected,source + ' / ' + target);
});

test('0.12 local bindings have sequential lexical scope and reject reassignment', () => {
  const invalid = [
    ['result = 2 >> {x | a = b + 1; b = 4; a};', /Local value 'b' used before its declaration at 1:\d+/],
    ['result = 2 >> {x | local = x + 1; local = 5; local};', /Duplicate or shadowed local name/],
    ['result = 2 >> {x | x = x + 1; x};', /Duplicate or shadowed local name/],
    ['rate = 30; result = 2 >> {x | rate = 4; x};', /Duplicate or shadowed local name/],
    ['a b = 30; result = 2 >> {x | aB = 4; x};', /Duplicate or shadowed local name/],
    ['result = 2 >> {x | a b = 3; aB = 4; a b};', /Duplicate or shadowed local name/],
    ['result = 2 >> {x | first = x + 1};', /A block must end with a value expression/],
    ['result = 2 >> {x | first = ; x};', /Expected value for local/],
    ['result = 2 >> {x | __miraHost = 3; x};', /Reserved local name/],
    ['result = 2 >> {x | first = x + 1; first}; result outside = first;', /Unknown identifier|Unbound/]
  ];
  for (const [source, diagnostic] of invalid) {
    const failure = compileError(source);
    assert.notEqual(failure.status,0,source);
    assert.match(failure.stderr, diagnostic,source);
  }
});

test('0.12 generated JS uses const and PHP captures only referenced external values', () => {
  const source = [
    'rate = 3;',
    'unused = 99;',
    'result = 4 >> {x |',
    '  subtotal = x * rate;',
    '  subtotal >> {y | other = subtotal + y; other + rate}',
    '};'
  ].join('\n');
  const js=compile(source,'js');
  const php=compile(source,'php');
  assert.match(js,/const subtotal =/);
  assert.match(php,/\$subtotal =/);
  assert.match(php,/function\(\$x\) use \(\$rate\)/);
  assert.doesNotMatch(php,/use \(\$rate, \$unused/);
  assert.equal(run(source,'js'),'27');
  assert.equal(run(source,'php'),'27');
});

test('0.12 top-level definition scanner ignores = inside nested blocks', () => {
  const cases = [
    ['result = 2 >> {x | doubled = x * 2; doubled};', '4'],
    ['result = (2 >> {x | doubled = x * 2; doubled}) + 1;', '5'],
    ['result = [2, 3] ~ missing;', null]
  ];
  for (const [source,expected] of cases.slice(0,2))
    for (const target of ['js','php'])
      assert.equal(run(source,target),expected,source+' / '+target);
  const expressionStatement = '1 >> {value | doubled = value * 2; doubled}; result = 3;';
  for (const target of ['js','php'])
    assert.equal(run(expressionStatement,target),'3');
  const multipleTopLevel = compileError('result = 1 = 2;');
  assert.notEqual(multipleTopLevel.status,0);
  assert.match(multipleTopLevel.stderr,/Unexpected second =/);
});

test('0.12.1 refuses generated-name collisions between block parameters and outer names', () => {
  const failures = [
    'a b = 4; result = (a b + 1) >> {aB | a b + aB};',
    'result = 4 >> {a b | (a b + 1) >> {aB | a b + aB}};',
    'result = 4 >> {aB | (aB + 1) >> {a b | aB + a b}};'
  ];
  for (const source of failures) {
    for (const target of ['js','php']) {
      const failure=compileError(source,target);
      assert.notEqual(failure.status,0,source);
      assert.match(failure.stderr,/Generated-name collision.*block parameter.*at 1:\d+/,source);
    }
  }
  for (const [source,expected] of [
    ['result = 4 >> {x | (x + 1) >> {x | x * 2}};', '10'],
    ['x = 100; result = 5 >> {x | x + 1};', '6'],
    ['result = 4 >> {a b | (a b + 1) >> {c | a b + c}};', '9']
  ]) {
    for (const target of ['js','php'])
      assert.equal(run(source,target),expected,source+' / '+target);
  }
});

test('0.12.1 diagnostics identify local self-reference and forward reference at source position',()=>{
  const failures = [
    ['result = 2 >> {x | before = after + x; after = 4; before};', 'after'],
    ['result = 2 >> {x | before = before + x; before};', 'before'],
    ['result = 2 >> {x | early = x >> {y | y + later}; later = 3; early};', 'later'],
    ['result = 2 >> {x | early = if (true) then later else x; later = 3; early};', 'later'],
    ['result = 2 >> {x | first = 1; second = next; next = 3; second};', 'next']
  ];
  for (const [source,name] of failures) {
    for (const target of ['js','php']) {
      const failure=compileError(source,target);
      assert.notEqual(failure.status,0,source);
      assert.match(failure.stderr,new RegExp("Local value '"+name+"' used before its declaration at 1:\\d+"),source);
    }
  }
  const unrelated=compileError('result = 2 >> {x | value = missing + x; value};');
  assert.notEqual(unrelated.status,0);
  assert.match(unrelated.stderr,/Unknown identifier/);
  assert.doesNotMatch(unrelated.stderr,/before its declaration/);
});


test('0.12.2 named-function parameters reject mangling collisions on JS/PHP', () => {
  const failures = [
    ['sum: a b, and: aB = a b + aB; result = sum: 2, and: 3;', /Generated-name collision for function parameter aB.*at 1:\d+/],
    ['sum: a b,\\n and: aB = a b + aB; result = sum: 2, and: 3;'.replace('\\n','\n'), /Generated-name collision for function parameter aB.*at 2:\d+/],
    ['a b = 7; identity: aB = aB + 1; result = identity: 2;', /Generated-name collision for function parameter aB.*at 1:\d+/],
    ['identity: aB = aB + 1; a b = 7; result = identity: 2;', /Generated-name collision for function parameter aB.*at 1:\d+/],
    ['identity: __miraHost = __miraHost + 1; result = identity: 2;', /Reserved function parameter __miraHost.*at 1:\d+/]
  ];
  for (const [source, diagnostic] of failures) {
    for (const target of ['js', 'php']) {
      const outcome = compileError(source, target);
      assert.notEqual(outcome.status, 0, source + ' / ' + target);
      assert.match(outcome.stderr, diagnostic, source + ' / ' + target);
    }
  }
  for (const [source, expected] of [
    ['x = 100; increment: x = x + 1; result = increment: 5;', '6'],
    ['sum: a b, and: c = a b + c; result = sum: 2, and: 3;', '5']
  ]) {
    for (const target of ['js', 'php'])
      assert.equal(run(source, target), expected, source + ' / ' + target);
  }
});

test('0.13 optional definition locations preserve JS/PHP output and map runtime failure', () => {
  const source = [
    '# first line is a comment',
    'message = "one\\ntwo";',
    '',
    'read: item = item ~ missing;',
    'result = read: {present: 1};'
  ].join('\n');
  for (const target of ['js', 'php']) {
    const mapped = withSource(source, path => JSON.parse(execFileSync(
      'node', [compiler, path, target, '--locations'], {encoding:'utf8'}
    )));
    assert.equal(mapped.output, compile(source, target));
    assert.deepEqual(mapped.locations.map(({name, line, column}) => [name,line,column]),
      [['message',2,1],['read:',4,1],['result',5,1]]);
    const lines = mapped.output.split('\n');
    for (const entry of mapped.locations) {
      assert.ok(entry.generatedStartLine <= entry.generatedEndLine);
      assert.ok(entry.generatedEndLine < lines.length);
    }
    const read = mapped.locations[1];
    assert.match(lines[read.generatedStartLine - 1], /function read/);
    assert.match(lines[mapped.locations[2].generatedStartLine - 1], /result/);
    withSource(source, (_, dir) => {
      const outputPath = join(dir, target === 'js' ? 'failure.mjs' : 'failure.php');
      writeFileSync(outputPath, mapped.output);
      const child = spawnSync(target === 'js' ? 'node' : 'php', [outputPath], {encoding:'utf8'});
      assert.notEqual(child.status, 0);
      assert.match(child.stderr, /Missing record field: missing/);
      const match = target === 'js'
        ? child.stderr.match(/failure\.mjs:(\d+)/)
        : child.stderr.match(/on line (\d+)/);
      assert.ok(match, child.stderr);
      const generatedLine = Number(match[1]);
      assert.ok(generatedLine >= read.generatedStartLine && generatedLine <= read.generatedEndLine,
        child.stderr);
    });
  }
});


test('0.14 zero-parameter blocks are lazy, first class and return the final expression', () => {
  const cases = [
    ['result = () >> {| 42};', '42'],
    ['action = {| 20 + 1}; result = () >> action >> {x | x * 2};', '42'],
    ['unused = {| {present: 1} ~ missing}; result = 42;', '42'],
    ['result = () >> {| a = 20; b = a + 1; b * 2;};', '42'],
    ['base = 10; make: n = {| local = n + base; local * 2}; action = make: 11; result = () >> action;', '42'],
    ['result = 20 >> {x | y = x + 1; action = {| y * 2}; () >> action};', '42'],
    ['result = () >> {| x = 20; action = {| y = x + 1; y * 2}; () >> action};', '42'],
    ['identity: x = x; result = identity: (() >> {| 42});', '42'],
    ['result = 2 + (() >> {| 40});', '42'],
  ];
  for (const [source, expected] of cases)
    for (const target of ['js', 'php'])
      assert.equal(run(source, target), expected, source + ' / ' + target);
  assert.match(compile('action = {| 42}; result = () >> action;', 'js'), /\(action\)\(\)/);
  assert.match(compile('action = {| 42}; result = () >> action;', 'php'), /\(\$action\)\(\)/);
});

test('0.14 empty parentheses are not a value and literal block arity is checked', () => {
  const cases = [
    ['result = ();', /Empty \(\) is only allowed before >>/],
    ['result = [(), 2];', /Empty \(\) is only allowed before >>/],
    ['result = {| };', /A block needs at least one expression/],
    ['result = 1 >> {| 42};', /Pipeline needs a unary block/],
    ['result = () >> {x | x};', /Pipeline needs a zero-argument block/],
    ['result = () >> {x, y | x + y};', /Pipeline needs a zero-argument block/],
    ['result = () >> (_ + 1);', /Pipeline needs a zero-argument operator section/],
    ['result = () >> 42;', /Pipeline target must be a function/],
    ['result = {| 42} 1;', /Zero-argument block requires/],
    ['result = () >> {| x = y; y = 1; x};', /Local value 'y' used before its declaration/]
  ];
  for (const [source, diagnostic] of cases)
    for (const target of ['js','php']) {
      const failure = compileError(source,target);
      assert.notEqual(failure.status,0,source);
      assert.match(failure.stderr,diagnostic,source);
    }
});

test('CLI imports transitive files once from entry directory and executes both targets',()=>{
  const dir=mkdtempSync(join(tmpdir(),'mira-modules-'));
  try{
    mkdirSync(join(dir,'lib'));
    writeFileSync(join(dir,'lib/rate.mira'),'rate = 30;');
    writeFileSync(join(dir,'lib/fees.mira'),'import "lib/rate.mira"; fee: n = n * rate;');
    writeFileSync(join(dir,'app.mira'),'import "lib/fees.mira"; import "lib/rate.mira"; result = fee: 2;');
    for(const target of ['js','php']){
      const compiled=spawnSync('node',[compiler,join(dir,'app.mira'),target,'--locations'],{encoding:'utf8',cwd:tmpdir()});
      assert.equal(compiled.status,0,compiled.stderr);
      const {output,locations}=JSON.parse(compiled.stdout);
      assert.equal(locations.filter(l=>l.name==='rate').length,1);
      assert.equal(locations.find(l=>l.name==='rate').file,'lib/rate.mira');
      const actual=target==='js'?spawnSync('node',['-e',output+'\nconsole.log(result);'],{encoding:'utf8'}):
        spawnSync('php',['-r',output.replace(/^<\?php/,'')+'\necho $result;'],{encoding:'utf8'});
      assert.equal(actual.status,0,actual.stderr);assert.equal(actual.stdout.trim(),'60');
    }
    writeFileSync(join(dir,'lib/rate.mira'),'import "app.mira"; rate = 30;');
    const cycle=spawnSync('node',[compiler,join(dir,'app.mira'),'js'],{encoding:'utf8'});
    assert.notEqual(cycle.status,0);assert.match(cycle.stderr,/Import cycle: app\.mira -> lib\/fees\.mira -> lib\/rate\.mira -> app\.mira/);
  }finally{rmSync(dir,{recursive:true,force:true});}
});


test('0.31 shallow update preserves old data, replaces nested records, and supports sections',()=>{
  const source='base = {name: "Ada", info: {a: 1, b: 2}, hours: 2}; changed = base >> (update: _, with: {info: {a: 3}, hours: 4, paid: true}); result = {base: base, changed: changed};';
  for(const target of ['js','php'])assert.deepEqual(JSON.parse(run(source,target)),{base:{name:'Ada',info:{a:1,b:2},hours:2},changed:{name:'Ada',info:{a:3},hours:4,paid:true}});
});

test('0.31 update accepts empty operands, preserves special keys, and rejects nonportable inputs',()=>{
  for(const target of ['js','php']){
    assert.deepEqual(JSON.parse(run('result = update: [], with: {"__proto__": 7, "01": 8};',target)),JSON.parse('{"__proto__":7,"01":8}'));
    assert.deepEqual(JSON.parse(run('result = update: {a: 1}, with: {};',target)),{a:1});
    for(const source of ['result = update: [1], with: {a: 2};','result = update: 1, with: {};','result = update: {a: 1}, with: {"0": 2};']){
      const code=compile(source,target);
      const p=target==='js'?spawnSync('node',['-e',code],{encoding:'utf8'}):spawnSync('php',['-r',code.replace(/^<\?php/,'')],{encoding:'utf8'});
      assert.notEqual(p.status,0);assert.match(p.stderr,/expects records with non-integer keys/);
    }
    assert.match(compileError('update: a, with: b = a;',target).stderr,/Duplicate or conflicting selector/);
  }
});

test('0.31 record update in a multi-step block captures lexical values on PHP too',()=>{
  const source='patch = {hours: 4}; result = {hours: 2} >> {old | next = update: old, with: patch; next};';
  for(const target of ['js','php'])assert.deepEqual(JSON.parse(run(source,target)),{hours:4});
});
