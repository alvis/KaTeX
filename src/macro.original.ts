export type GenericMacroArgumentType = (IndicatorArgument | BracketArgument)[];

export interface MacroDefinition<T = GenericMacroArgumentType> {
  name: string;
  arguments: T;
  processor(...args: (boolean | string | null)[]): string;
}

// export interface FunctionOutput {
//   expression: RegExp;
//   processor: (...args: string[]) => string;
// }

export interface BracketArgument {
  type: 'bracket';
  optional: boolean | string;
  leftBracket: string;
  rightBracket: string;
}

export interface IndicatorArgument {
  type: 'indicator';
  indicator: string;
}

// export interface FunctionOutput {
//   nam10Me: string;
//   arguments: Array<IndicatorArgument | BracketArgument>;
//   processor: (...args: string[]) => string;
// }

// const reRegExpChar = /[\\^$.*+?()[\]{}|]/g;
// const reHasRegExpChar = RegExp(reRegExpChar.source);

// function escapeRegExp(expression: string): string {
//   return expression && reHasRegExpChar.test(expression)
//     ? expression.replace(reRegExpChar, '\\$&')
//     : expression;
// }

// interface Macro {
//   name: string;
//   argumentStart: number;
// }

export interface MatchedMacro {
  fullMacro: string;
  expandedMacro: string;
}

export function matchArguments(
  input: string,
  definition: MacroDefinition
): MatchedMacro {
  let fullMacro = `\\${definition.name}`;
  const matchedArguments: (boolean | string | null)[] = [];

  // check if the marco match the expected
  if (input.substring(0, fullMacro.length) !== fullMacro) {
    throw new Error(
      `The input (${input.substring(
        0,
        fullMacro.length
      )}) doesn't contained the expected ${fullMacro}.`
    );
  }
  console.log(definition.arguments);
  // scan for arguments
  let nextArgument = 0;
  let position = fullMacro.length;
  let parsedArgument = '';
  // let parsingArgument: ParsingArgument | null = null;
  const expectingCharacters: string[] = [];
  while (position < input.length) {
    let bypassed = false;
    const character = input.charAt(position);
    if (nextArgument >= definition.arguments.length) {
      // stop scanning when there is no more to expect
      break;
    }

    if (expectingCharacters.length) {
      // check if it is escaped
      const prefix = parsedArgument.match(/\\+$/g);
      if (prefix && prefix.length % 2 === 1) {
        // escaped
        parsedArgument += character;
      } else {
        // normal
        // parse input until a matching bracket is found
        if (character === expectingCharacters[0]) {
          // close the bracket
          expectingCharacters.shift();

          if (expectingCharacters.length === 0) {
            // move on to the next argument for as it is now completed
            nextArgument++;
            matchedArguments.push(parsedArgument);
            parsedArgument = '';
          }
        } else {
          if (character === '{') {
            expectingCharacters.unshift('}');
          } else {
            const argument = definition.arguments[nextArgument];
            if (
              argument.type === 'bracket' &&
              [argument.leftBracket, argument.rightBracket, '}'].includes(
                character
              )
            ) {
              // any opening bracket in the same type should be escaped except {}
              const lineno = input.split('\n').length;
              throw new Error(
                `An unexpected bracket ($character) detected for \\${definition.name} at line ${lineno}.`
              );
            }
          }

          parsedArgument += character;
        }
      }
    } else {
      // move to next argument
      const argument = definition.arguments[nextArgument];
      console.log(`current arg: `, argument);
      console.log('char: ', character);
      switch (argument.type) {
        case 'bracket':
          if (character === argument.leftBracket) {
            // matching an opening bracket
            expectingCharacters.unshift(argument.rightBracket);
          } else if (argument.optional) {
            // by passing it as it can be optional
            bypassed = true;
            nextArgument++;

            // push the value to the matched stack
            matchedArguments.push(
              typeof argument.optional === 'string' ? argument.optional : null
            );
          } else {
            // throw error if it is required
            const lineno = input.split('\n').length;
            throw new Error(
              `A required argument is missing for \\${definition.name} at line ${lineno}.`
            );
          }
          break;
        case 'indicator':
          if (character === argument.indicator) {
            matchedArguments.push(true);
          } else {
            matchedArguments.push(false);

            // move to next argument as an indicator is optional
            bypassed = true;
          }
          nextArgument++;
          break;
        default:
          throw new Error('Argument type must be either bracket or indicator');
      }
    }

    // move on if there is no optional component
    if (bypassed === false) {
      fullMacro += character;
      position++;
    }
  }

  // throw error if there is any unmatched brackets
  if (expectingCharacters.length) {
    const lineno = input.split('\n').length;
    throw new Error(
      `\\${definition.name} has unmatched brackets at line ${lineno}.`
    );
  }
  console.log(`matched: `, matchedArguments);
  const expandedMacro = definition.processor(fullMacro, ...matchedArguments);

  return { fullMacro, expandedMacro };
}

function matchMacros(
  input: string,
  definitions: MacroDefinition[]
): MatchedMacro[] {
  const indexedDefinitions: {
    [name: string]: MacroDefinition;
  } = definitions.reduce(
    (o, definition) => ({ ...o, [definition.name]: definition }),
    {}
  );
  const matchedMacros: MatchedMacro[] = [];

  const expression = `([\\\\]*)\\\\(${definitions
    .map(definition => definition.name)
    .join('|')})([^a-zA-Z0-9]|$)`;

  const regexp = RegExp(expression, 'g');
  let matches: RegExpExecArray | null = regexp.exec(input);
  while (matches) {
    // either no escape "\" or the escape is balanced so that the marco won't escape
    if (matches[1].length % 2 === 0) {
      const matchedMacro = matchArguments(
        input.substring(matches.index + matches[1].length),
        indexedDefinitions[matches[2]]
      );

      matchedMacros.push(matchedMacro);
    }

    // look for another match
    matches = regexp.exec(input);
  }

  return matchedMacros;
}

export function define(
  definition: MacroDefinition<number | string | GenericMacroArgumentType>
): MacroDefinition {
  // check the validity of the name
  if (definition.name.search(/^[a-zA-Z][a-zA-Z0-9]*$/) === -1) {
    throw new Error(`Name must comprise alphabets and numbers only.`);
  }

  /* ----- prase arguments ----- */
  const argumentDefinitions: (IndicatorArgument | BracketArgument)[] = [];
  if (Array.isArray(definition.arguments)) {
    // todo: check validity

    argumentDefinitions.push(...definition.arguments);
  } else {
    const addBracketedArgument = (
      pair: string,
      optional: boolean | string
    ): void => {
      argumentDefinitions.push({
        type: 'bracket',
        optional,
        leftBracket: pair.charAt(0),
        rightBracket: pair.charAt(1)
      });
    };
    if (typeof definition.arguments === 'number') {
      for (let i = 0; i < definition.arguments; i++) {
        addBracketedArgument('{}', false);
      }
    } else if (typeof definition.arguments === 'string') {
      // position of current character in definition.arguments
      let currentPosition = 0;

      while (currentPosition < definition.arguments.length) {
        const argumentType = definition.arguments.charAt(currentPosition);
        switch (argumentType) {
          case 's': // '*' (optional)
            argumentDefinitions.push({
              type: 'indicator',
              indicator: '*'
            });
            break;
          case 'm': // {}
            addBracketedArgument('{}', false);
            break;
          case 'o': // [] (optional)
            addBracketedArgument('[]', true);
            break;
          case ' ':
            // skip space
            break;
          default:
            throw new Error(
              `unregcognised agrument type (${argumentType}) in function \\${definition.name}.`
            );
        }
        currentPosition++;
      }
    }
  }

  // ---------------------------------------- //

  return {
    ...definition,
    arguments: argumentDefinitions
  };
}

export function parse(input: string, macros: MacroDefinition[]): string {
  // save expanded input in parsedInput
  let parsedInput = input;

  // continue expanding until there is no match
  let somethingMatched = true;
  while (somethingMatched) {
    somethingMatched = false;

    // try all macros
    const matches = matchMacros(parsedInput, macros);
    console.log(`matches: ${JSON.stringify(matches)}`);

    if (matches.length) {
      somethingMatched = true;

      for (const match of matches) {
        parsedInput = parsedInput
          .split(match.fullMacro)
          .join(match.expandedMacro);
      }
    }
  }

  // return the final product
  return parsedInput;
}

//   // try to

//   // return the final product
//   return parsedInput;
// }

// /* ----- Test Type Checking ----- */
// it('the first character of the macro name must be alphabetic', () => {
//   define({ name: '1name' });
// });

// it('the macro name must comprise alphabetic characters and numbers only', () => {
//   define({ name: 'name' });
//   define({ name: 'name1' });
//   define({ name: 'Name' });
//   define({ name: 'Name1' });
//   define({ name: 'name=' });
// });

// define({
//     name: 'test',
//     arguments: '* m',
//     processor: (full: string, star: string, required: string) =>
//       `${full}-${star ? 'star' : 'non-star'}-${required}`
//   })

// // ---------------------------------------- //

// /* ----- Test Expansion ----- */

import { createHash } from 'crypto';
function md5(input: string): string {
  return createHash('md5')
    .update(input)
    .digest('hex');
}

const marcos = [
  define({
    name: 'full',
    arguments: '',
    processor: (full: string): string => md5(full)
  }),
  define({
    name: 'star',
    arguments: 'sm',
    processor: (full: string, star: boolean, content: string): string =>
      (star ? 'star' : 'non-star') + content
  }),
  define({
    name: 'nest',
    arguments: 'm',
    processor: (full: string, nest: string): string => '\\mathbf{\\full{nest}}'
  })
];

// it('should leave nested built-in macros untouched', () => {
//   expect(expand('\test*{content}').equals('\test*{content}-star-content'));
// });
// // ---------------------------------------- //
// const result = expand('\test*{content}', marcos);
// console.log(result);
// console.log(result === `${md5('\test*{content}')}-star-content`);

const result2 = parse('\\star*{123}', marcos);
// const result3 = expand('\\star*{abc}', marcos);
console.log(result2);
