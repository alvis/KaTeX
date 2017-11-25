// @flow
/**
 * Macro for KaTeX.
 * This new macro praser enables command definition like those in xparse.
 */

declare class RegExpExecArray extends Array<string> {
    index: number;
    input: string;
}

type Primitive = string | number | boolean;

export type FullMacroArgument = Array<IndicatorArgument | BracketArgument>;

export type FlexibleMacroArgument = number | string | FullMacroArgument;

export type Processor = (fullMacro: string, ...args: Array<any>) => Primitive;

export interface FlexibleMacroDefinition {
    /** name of the macro */
    name: string;

    /**
     * arguments can be specified either by a string like xparse or a number as the
     * number of agruments. e.g. 'mod<>' represents a macro in the form of
     * '\marco{}{}<>' where the second agrument is optional; and 3 represents
     * 'mmm', i.e. a macro in the form of \macro{}{}{}.
     */
    +args?: number | string | FullMacroArgument;

    /**
     * A processor describes how a macro should be parsed. It can be specified in
     * two forms - a string or function. For the string form, arguments should be
     * specified as #0, #1, #2..., up to #9. e.g. '\@if{#0}{#1}{#2}'; for the
     * functional form, see Processor.
     */
    +processor: Processor | string;
}

export interface FullMacroDefinition {
    /** name of the macro */
    name: string;

    /**
     *
     */
    args: FullMacroArgument;

    /**
     * A processor is a function which describes how a macro should be parsed.
     * See Processor for its definitions.
     */
    processor: Processor;
}

export interface BracketArgument {
    type: "bracket";
    optional: boolean | string;
    leftBracket: string;
    rightBracket: string;
}

export interface IndicatorArgument {
    type: "indicator";
    indicator: string;
}

export interface MatchedMacro {
    fullMacro: string;
    expandedMacro: Primitive;
}

/**
 * a recursive type representing a nested structure of the input
 * @example see example output of Parser._getBlocks
 */
export type Blocks = Array<string | Blocks>;

export class Parser {
    /** the input string to be parsed */
    _input: string;

    // /**
    //  * a private method which reduces the input into nested blocks
    //  * @param start - the starting characteition (for recursive analysis)
    //  * @return - nest blocks of strings represented in the array form
    //  *
    //   * @example input after a macro is nested in the same level as the macro
    //   *  return ['abc', ['\def', '{}', 'ghk']]
    //   * _input = 'abc\def{}ghk'
    //   * @example bracketed macro results input behind it at the original level
    //   *  return ['abc', ['\def', '{}'], 'ghk']
    //   * _input = 'abc{\def{}}ghk'
    //   * @example
    //   *  return ['abc', '\def{}', 'ghk']
    //   * _input = 'abc\def{abc\def{}ghk}ghk'
    //  *
    //  * @example
    //  *  return ['abc', '\def{}', 'ghk']
    //  * _input = 'mmD<>{default}o'
    //  */
    // _getBlocks(start: number): Blocks {}

    /**
     * process a tex sequence with high-level macros
     * @param input - sequence of tokens
     * @param macros - high-level macros
     * @param history - a list of historic input as a way to detect an infinite loop
     * @return low-level toekens (string), or number/boolean for other macros
     */
    parse(
        input: Primitive,
        macros: FullMacroDefinition[],
        history?: string[] = []
    ): Primitive {
        // save expanded input in parsedInput
        let parsedInput = input;

        // a counter for the parsed input being a number/boolean
        let nonStrings = 0;

        // let i = 0;
        //  continue expanding until there is no match
        // let somethingMatched = true;
        // while (somethingMatched && i < 5) {
        //     somethingMatched = false;
        //     i++;

        // skip parsing if the input is number or boolean
        if (typeof parsedInput === "string") {
            // try all macros
            const matches = matchMacros(parsedInput, macros);

            if (matches.length) {
                // somethingMatched = true;
                nonStrings = 0;

                for (const match of matches) {
                    const { fullMacro, expandedMacro } = match;
                    if (
                        typeof expandedMacro === "string" &&
                        typeof parsedInput === "string"
                    ) {
                        /**
                         * replace the macro with the expanded one if the
                         * expansion doesn't contain any number or boolean
                         **/
                        parsedInput = parsedInput
                            .split(fullMacro)
                            .join(expandedMacro);
                    } else if (
                        ["number", "boolean"].includes(typeof expandedMacro)
                    ) {
                        /**
                         * record how many number/boolean are found in the
                         * expanded macro. for now, they will not be expanded
                         * till the end. they should be expanded in later time
                         * by macros such as \@if. the number of number/boolean
                         * found in the expansion is important for determining
                         * if the parsed input contains a mix of string and
                         * boolean/number, which is disallowed.
                         **/

                        nonStrings++;
                    }
                }

                if (nonStrings === matches.length) {
                    /**
                     * if the number of matches equals the number of number/boolean
                     * found in the previous iteration, it indicates that they are
                     * the only marco expanded. now we should deal with it. there
                     * are only two scenarios
                     * 1. parsedInput contains one macro which returns a
                     * number/boolean and there is no any string before or after
                     * the input. In this case, parsedInput should be expanded.
                     * 2. there are multiple macros returning number/boolean or
                     * there are non-empty strings before/after found in
                     * parsedInput. In this case, an error should be throwed.
                     **/

                    // if scenario 1 is matched, parsedInput will be expanded here
                    if (matches.length === 1) {
                        const { fullMacro, expandedMacro } = matches[0];
                        if (
                            parsedInput.trim() === fullMacro &&
                            ["number", "boolean"].includes(typeof expandedMacro)
                        ) {
                            /**
                             * now parsedInput becomes a number or boolean when it
                             * is the sole macro in the input, so that it can be
                             * consumed by a macro as an input.
                             **/
                            parsedInput = expandedMacro;
                        }
                    }

                    // must be scenario 2 if the expansion isn't a number or boolean
                    if (typeof parsedInput === "string") {
                        throw new Error(`The parsed input (${parsedInput}) contains a mix of
                                    number, boolean and string.`);
                    }
                }

                // }
            }
        }

        /**
         * further parse the input when something has changed. but before that, detect
         * if there is an infinite loop.
         **/
        if (
            parsedInput === input ||
            typeof parsedInput === "number" ||
            typeof parsedInput === "boolean"
        ) {
            return parsedInput;
        } else {
            if (history.includes(parsedInput)) {
                throw new Error(
                    `Detected an infinite: ${JSON.stringify([
                        ...history,
                        parsedInput,
                    ])}`
                );
            }

            return parse(parsedInput, macros, [...history, parsedInput]);
        }
    }
}

/**
 * match a macro with its arguments
 * @param input - a substring of the input, starting with the macro to match
 * @param definition - the definition of the macro to match
 * @param [startingLocation = 0] - the location at which the match starts
 * @return the matched macro with its arguments and its expansion
 */
export function matchArguments(
    input: string,
    definition: FullMacroDefinition,
    startingLocation: nummber = 0
): MatchedMacro {
    let fullMacro = `\\${definition.name}`;
    const matchedArguments: (boolean | string | null)[] = [];

    // check if the marco match the expected
    // (to be removed when is has been converted to a class.
    // it should take the starting position in future)
    if (input.substring(startingLocation, fullMacro.length) !== fullMacro) {
        throw new Error(
            `The input (${input.substring(
                startingLocation,
                fullMacro.length
            )}) doesn't contained the expected ${fullMacro}.`
        );
    }

    // the position of agrument in the macro definition to be processed
    let argumentPosition = 0;

    /**
     * the scaning position specify the cursor position in the input string
     * it should begins right after the name of macro (e.g. 2 for \m{a})
     **/
    let position = fullMacro.length;

    // a container storing the parsed agrument so far
    let parsedArgument: string = "";

    /**
     * a list of paired characters expected to be found on the right of the cursor
     * e.g. in \a{\b[\c<d>]}, the expected paried characters at position 4 is ['}'],
     *      at 7 and 10 is [']', '}'], and at 11 is again ['}'].
     */
    const expectedCharacters: string[] = [];

    // start scanning
    while (position < input.length) {
        // indicates if the captured character should be appended to parsedArgument
        let shouldAddCharacterToParsedAgrument = true;

        // obtain the character at the cursor position
        const character = input.charAt(position);

        /**
         * as macro can have optional arguments, it may not have as many agruments
         * in the input as defined, but it definitely can't be more than that.
         **/
        if (argumentPosition >= definition.args.length) {
            // stop scanning when there is no more to expect
            break;
        }

        /**
         * the logic is as follow
         * 1. if there is any unpaired brackets, expect an opening bracket of the
         *    next agrument.
         * 2. if the is no more unparied brackets, it indicates that there is
         *    another agrument upcoming (e.g. position 5 for \a{b}{c}) as if the
         *    whole macro has finished, it should be caught above. Try to capture
         *    the agrument (either an opening bracket or optional indicator).
         **/
        if (expectedCharacters.length) {
            /**
             * now we are taking all characters until the companion bracket appear
             * any extra bracket appears in the character sequence will be taken
             * into account and they have to all paired up before we can declare
             * that our longed companion bracket is found. e.g. in \a{\b{c}def},
             * the } in position 8 would not be considered as our companion bracket
             * because there will be two }s (['}', '}']) in expectedCharacters,
             * preventing an unwanted mismatch.
             **/

            // before matching a closing bracket, check if it has escaped
            const prefix = parsedArgument.match(/\\+$/g);
            if (prefix && prefix.length % 2 === 1) {
                // an escaped bracket can only be part of the argument
                parsedArgument += character;
            } else {
                /*
                 * now parse input until a matching bracket is found. there are two
                 * scenarios for the capture character to be taken care of.
                 * 1. a closing bracket: close it and check if there's the last one
                 * 2. a opening bracket: add the closing to expectedCharacters
                 */
                if (character === expectedCharacters[0]) {
                    /* scenario 1 */

                    // close one bracket, be minded that it may be another pair
                    expectedCharacters.shift();

                    // make sure it is the ultimate matching bracket
                    if (expectedCharacters.length === 0) {
                        // move on to the next argument for as it is now completed
                        argumentPosition++;
                        matchedArguments.push(parsedArgument);
                        parsedArgument = "";
                    } else {
                        // if not, continue the search
                        parsedArgument += character;
                    }
                } else {
                    /* scenario 2 */
                    const argument = definition.args[argumentPosition];
                    if (
                        argument.type === "bracket" &&
                        character === argument.leftBracket
                    ) {
                        /**
                         * captured the opening bracket. now expect the closing
                         * bracket which is pushed to expectedCharacters.
                         **/
                        expectedCharacters.unshift(argument.rightBracket);
                    } else {
                        // no unpaired bracket is expected
                        if (argument.type === "bracket" && character === "}") {
                            // [
                            //      argument.leftBracket,
                            //     argument.rightBracket,
                            //     "}"
                            // ].includes(character)) {
                            /**
                             * any opening bracket in the same type should be
                             * escaped except {}
                             **/
                            const lineno = input.split("\n").length;
                            throw new Error(
                                `An unexpected bracket (${character}) detected ` +
                                    `for \\${definition.name} at line ${lineno}.`
                            );
                        }
                    }

                    // add the character to the part of the parsed argument
                    parsedArgument += character;
                }
            }
        } else {
            // move to the opening of next argument (see logic 2)
            const argument = definition.args[argumentPosition];
            switch (argument.type) {
                case "bracket":
                    if (character === argument.leftBracket) {
                        // got the specified left bracket and expect its companion
                        expectedCharacters.unshift(argument.rightBracket);
                    } else if (argument.optional) {
                        // by passing it as it can be optional
                        shouldAddCharacterToParsedAgrument = false;
                        argumentPosition++;

                        // push the value to the matched stack
                        matchedArguments.push(
                            typeof argument.optional === "string"
                                ? argument.optional
                                : null
                        );
                    } else {
                        // throw error if the expected agrument is required
                        const lineno = input.split("\n").length;
                        throw new Error(
                            `A required argument is missing ` +
                                `for \\${definition.name} at line ${lineno}.`
                        );
                    }
                    break;
                case "indicator":
                    if (character === argument.indicator) {
                        matchedArguments.push(true);
                    } else {
                        matchedArguments.push(false);

                        // move to next argument as an indicator is optional
                        shouldAddCharacterToParsedAgrument = false;
                    }
                    argumentPosition++;
                    break;
                default:
                    throw new Error(`Unknown argument type ${argument.type}`);
            }
        }

        /**
         * as there may be spacing between agruments, it's not necessarily an error
         * if there's nothing caught above. Let's move on and record the character.
         **/
        if (shouldAddCharacterToParsedAgrument) {
            fullMacro += character;
            position++;
        }
    }

    // throw error if there is any unpaired brackets
    if (expectedCharacters.length) {
        const lineno = input.split("\n").length;
        throw new Error(
            `\\${definition.name} has unpaired brackets at line ${lineno}.`
        );
    }

    /**
     * now since we have got the full macro based on its defintion, we send it to
     * the specified processor for expansion.
     **/
    const expandedMacro = definition.processor(fullMacro, ...matchedArguments);

    // return the matched macro and its expansion, discarding the rest of the input
    return { fullMacro, expandedMacro };
}

/**
 * identify macros in the input and send them to matchArguments for processing
 * @param input - sequence of tokens
 * @param macros - high-level macros
 * @return a list of expanded macros
 */
function matchMacros(
    input: string,
    definitions: FullMacroDefinition[]
): MatchedMacro[] {
    // turn the definitions into a Map format
    const indexedDefinitions: {
        [string]: FullMacroDefinition,
    } = definitions.reduce(
        (o, definition) =>
            Object.assign(o, {
                [definition.name]: definition,
            }),
        {}
    );

    // a list of matched macros
    const matchedMacros: MatchedMacro[] = [];

    // construct a regular expression that can capture all macros by name
    // e.g. \@if, \@empty (without the agruments)
    const expression = `([\\\\]*)\\\\(${definitions
        .map(definition => definition.name)
        .join("|")})([^a-zA-Z0-9]|$)`;

    // match the input against the expression above
    const regexp = RegExp(expression, "g");
    let matches: RegExpExecArray | null = regexp.exec(input);
    while (matches) {
        const [_, escape, name] = matches;

        /**
         * pass it to matchArguments if there is no escape character "\" or the
         * escape is balanced (e.g. \\\macro) so that the marco won't escape
         **/
        if (escape.length % 2 === 0) {
            const matchedMacro = matchArguments(
                // additional shift is added to account the non-escaped characters
                // input.substring(matches.index + escape.length)
                // , indexedDefinitions[name]
                // todo: del?
                input,
                indexedDefinitions[name],
                matches.index + escape.length
            );

            // record the match
            matchedMacros.push(matchedMacro);
        }

        // continue the match as regexp.exec only return one match at a time
        matches = regexp.exec(input);
    }

    return matchedMacros;
}

/**
 * define a macro
 * @param definition description of a macro
 * @return a fully defined macro
 */
export function define(definition: FlexibleMacroDefinition): FullMacroDefinition {
    // check the validity of the name
    if (definition.name.search(/^[@a-zA-Z][a-zA-Z0-9]*$/) === -1) {
        throw new Error(`Name must comprise alphabets and numbers only.`);
    }

    /* ----- prase arguments ----- */
    const args: FullMacroArgument = [];
    if (Array.isArray(definition.args)) {
        // being an array indicates that it should be a FullMacroArgument

        // todo: check validity

        args.push(...definition.args);
    } else {
        /**
         * a helper function converting other specifications to a FullMacroArgument
         * @param pair a bracket pair
         * @param optional indicate whether the agrument is optional
         *        if true is given, the default value will be ''
         *        if a string is given, it will be the default value of the agrument
         */
        const addBracketedArgument = (
            pair: string,
            optional: boolean | string
        ): void => {
            args.push({
                type: "bracket",
                optional,
                leftBracket: pair.charAt(0),
                rightBracket: pair.charAt(1),
            });
        };

        // conversation begin here
        switch (typeof definition.args) {
            case "number": {
                for (let i = 0; i < definition.args; i++) {
                    addBracketedArgument("{}", false);
                }
                break;
            }
            case "string": {
                // position of current character in definition.args
                let currentPosition = 0;

                // list of allowed custom brackets
                const allowedBrackets = ["{}", "()", "<>", "[]"];

                // parse the args definitions
                while (currentPosition < definition.args.length) {
                    const argumentType = definition.args.charAt(currentPosition);
                    switch (argumentType) {
                        case "s":
                            /**
                             * s for * (e.g. `s` for matching \f*)
                             **/
                            args.push({
                                type: "indicator",
                                indicator: "*",
                            });
                            break;
                        case "t":
                            /**
                             * t for customer indicator (e.g. `t#` for matching \f#)
                             * NOTE: tokens such as \star can't be used as a custom indicator
                             **/
                            args.push({
                                type: "indicator",
                                indicator: definition.args.charAt(
                                    currentPosition + 1
                                ),
                            });

                            // advance 1 position for accounting the additional character
                            currentPosition++;
                            break;
                        case "m":
                            /**
                             * m for standard mandatory bracket {} (e.g. `m` for matching \f{})
                             **/
                            addBracketedArgument("{}", false);
                            break;
                        case "r":
                        case "d":
                        case "D":
                            /**
                             * customer brackets such as '{}', '()', '<>', and '[]'
                             * r for mandatory custom bracket (e.g. `r<>` for matching \f<>)
                             * d  for optional custom bracket (e.g. `d<>` for matching \f or \f<>)
                             * D for optional custom bracket with default (e.g. `D<>{\@true}`)
                             * NOTE: tokens such as \lbracket\rbracket can't be used
                             **/

                            const bracket = definition.args.substring(
                                currentPosition + 1,
                                currentPosition + 2
                            );

                            // check validity
                            if (!allowedBrackets.includes(bracket)) {
                                throw new Error(
                                    `unregcognised custom bracket (${bracket}) ` +
                                        `found in function \\${definition.name}.`
                                );
                            }

                            let optional: string;

                            switch (argumentType) {
                                case "r":
                                    optional = false;
                                    break;
                                case "d":
                                    optional = true;
                                    break;

                                case "D":
                                    optional = getDefault(
                                        definiiton.args,
                                        currentPosition + 1
                                    );
                                    break;
                            }

                            addBracketedArgument(bracket, optional);

                            // advance the position (bracket + default)
                            currentPosition +=
                                2 +
                                (typeof optional === "string"
                                    ? optional.length + 2
                                    : 0);
                            break;
                        case "o":
                            /**
                             * o for standard optional bracket [] (e.g. `o` for matching \f)
                             **/
                            addBracketedArgument("[]", true);
                            break;
                        case "O":
                            /**
                             * O for standard optional bracket [] with default (e.g. `O{\@true}`)
                             **/

                            const optional = getDefault(
                                definiiton.args,
                                currentPosition + 1
                            );

                            addBracketedArgument("[]", optional);

                            // adjust the position by the length of the default value {default}
                            currentPosition += optional + 2;
                            break;
                        case " ":
                            // skip space
                            break;
                        default:
                            throw new Error(
                                `unregcognised agrument type (${argumentType}) ` +
                                    `found in function \\${definition.name}.`
                            );
                    }
                    currentPosition++;
                }
                break;
            }
            default:
            // no agrument
        }
    }

    // ----------------------------------------
    // parse processor
    const processor =
        typeof definition.processor === "function"
            ? definition.processor
            : createProcessor(definition.processor);

    return { name: definition.name, args, processor };
}

/**
 * create a helper function for turning an string type processor to a read function
 * @param expression an expression which take #0, #1, ..., #9 as arguments
 * @return a processor function
 */
function createProcessor(expression: string): Processor {
    return (fullMacro, ...inputs: any[]): string => {
        // replace #0, #1, ..., #9 to the corresponding arguments
        let parsedInput = expression;
        inputs.forEach(
            (input, index) => (parsedInput = parsedInput.replace(`#{index}`, input))
        );

        return parsedInput;
    };
}

/**
 * process a tex sequence with high-level macros
 * @param input - sequence of tokens
 * @param macros - high-level macros
 * @param history - a list of historic input as a way to detect an infinite loop
 * @return low-level toekens (string), or number/boolean for other macros
 */
export function parse(
    input: Primitive,
    macros: FullMacroDefinition[],
    history?: string[] = []
): Primitive {
    // save expanded input in parsedInput
    let parsedInput = input;

    // a counter for the parsed input being a number/boolean
    let nonStrings = 0;

    // let i = 0;
    //  continue expanding until there is no match
    // let somethingMatched = true;
    // while (somethingMatched && i < 5) {
    //     somethingMatched = false;
    //     i++;

    // skip parsing if the input is number or boolean
    if (typeof parsedInput === "string") {
        // try all macros
        const matches = matchMacros(parsedInput, macros);

        if (matches.length) {
            // somethingMatched = true;
            nonStrings = 0;

            for (const match of matches) {
                const { fullMacro, expandedMacro } = match;
                if (
                    typeof expandedMacro === "string" &&
                    typeof parsedInput === "string"
                ) {
                    /**
                     * replace the macro with the expanded one if the
                     * expansion doesn't contain any number or boolean
                     **/
                    parsedInput = parsedInput.split(fullMacro).join(expandedMacro);
                } else if (["number", "boolean"].includes(typeof expandedMacro)) {
                    /**
                     * record how many number/boolean are found in the
                     * expanded macro. for now, they will not be expanded
                     * till the end. they should be expanded in later time
                     * by macros such as \@if. the number of number/boolean
                     * found in the expansion is important for determining
                     * if the parsed input contains a mix of string and
                     * boolean/number, which is disallowed.
                     **/

                    nonStrings++;
                }
            }

            if (nonStrings === matches.length) {
                /**
                 * if the number of matches equals the number of number/boolean
                 * found in the previous iteration, it indicates that they are
                 * the only marco expanded. now we should deal with it. there
                 * are only two scenarios
                 * 1. parsedInput contains one macro which returns a
                 * number/boolean and there is no any string before or after
                 * the input. In this case, parsedInput should be expanded.
                 * 2. there are multiple macros returning number/boolean or
                 * there are non-empty strings before/after found in
                 * parsedInput. In this case, an error should be throwed.
                 **/

                // if scenario 1 is matched, parsedInput will be expanded here
                if (matches.length === 1) {
                    const { fullMacro, expandedMacro } = matches[0];
                    if (
                        parsedInput.trim() === fullMacro &&
                        ["number", "boolean"].includes(typeof expandedMacro)
                    ) {
                        /**
                         * now parsedInput becomes a number or boolean when it
                         * is the sole macro in the input, so that it can be
                         * consumed by a macro as an input.
                         **/
                        parsedInput = expandedMacro;
                    }
                }

                // must be scenario 2 if the expansion isn't a number or boolean
                if (typeof parsedInput === "string") {
                    throw new Error(`The parsed input (${parsedInput}) contains a mix of
                                number, boolean and string.`);
                }
            }

            // }
        }
    }

    /**
     * further parse the input when something has changed. but before that, detect
     * if there is an infinite loop.
     **/
    if (
        parsedInput === input ||
        typeof parsedInput === "number" ||
        typeof parsedInput === "boolean"
    ) {
        return parsedInput;
    } else {
        if (history.includes(parsedInput)) {
            throw new Error(
                `Detected an infinite: ${JSON.stringify([...history, parsedInput])}`
            );
        }

        return parse(parsedInput, macros, [...history, parsedInput]);
    }
}
