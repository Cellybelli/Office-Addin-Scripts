#!/usr/bin/env node

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

/// <reference path="custom-functions-data.ts"/> 
import * as fs from 'fs';
import * as ts from 'typescript';

export let errorLogFile = [];
export let skippedFunctions = [];

const CUSTOM_FUNCTION = 'customfunction'; // case insensitive @CustomFunction tag to identify custom functions in JSDoc
const HELPURL_PARAM = 'helpurl';
const VOLATILE = "volatile";
const STREAMING = "streaming";
const RETURN = "return";
const CANCELABLE = "cancelable";

const TYPE_MAPPINGS = {
    [ts.SyntaxKind.NumberKeyword]: 'number',
    [ts.SyntaxKind.StringKeyword]: 'string',
    [ts.SyntaxKind.BooleanKeyword]: 'boolean',
    [ts.SyntaxKind.AnyKeyword]: 'any',
    [ts.SyntaxKind.UnionType]: 'any',
    [ts.SyntaxKind.TupleType]: 'any'
};

const TYPE_MAPPINGS_COMMENT = {
    ['number']:1,
    ['string']:2,
    ['boolean']:3,
    ['any']:4
};

type CustomFunctionsSchemaDimensionality = 'invalid' | 'scalar' | 'matrix';

/**
 * Check the error log and return true if any errors found
 */
export function isErrorFound():boolean {
    if (errorLogFile[0]){
        return true;
    }
    else {
        return false;
    }
}

/**
 * Generate the metadata of the custom functions
 * @param inputFile - File that contains the custom functions
 * @param outputFileName - Name of the file to create (i.e functions.json)
 */
export async function generate(inputFile: string, outputFileName: string): Promise<void> {
    const sourceCode = fs.readFileSync(inputFile, 'utf-8');
    const sourceFile = ts.createSourceFile(inputFile, sourceCode, ts.ScriptTarget.Latest, true);

    var rootObject: CustomFunctionMetadata.Metadata = {functions: parseTree(sourceFile)};

    if (!isErrorFound()) {

        fs.writeFile(outputFileName, JSON.stringify(rootObject, null, 4), (err) => {
            if (err) {
                console.error(err);
                return;
            };
            console.log(outputFileName + " created for file: " + inputFile);
        }
        );
        if (skippedFunctions.length > 0) {
            console.log("The following functions were skipped.");
            for (let func in skippedFunctions) {
                console.log(skippedFunctions[func]);
            }
        }
    } else {
        console.log("There was one of more errors. We couldn't parse your file: " + inputFile);
        for (let err in errorLogFile) {
            console.log(errorLogFile[err]);
        }
    }
}

/**
 * Takes the sourcefile and attempts to parse the functions information
 * @param sourceFile source file containing the custom functions
 */
export function parseTree(sourceFile: ts.SourceFile): CustomFunctionMetadata.Function[] {
    const metadata: CustomFunctionMetadata.Function[] = [];

    visit(sourceFile);
    return metadata;

    function visit(node: ts.Node) {
        if (ts.isFunctionDeclaration(node)) {
            if (node.parent && node.parent.kind === ts.SyntaxKind.SourceFile) {
                const func = node as ts.FunctionDeclaration;

                if (isCustomFunction(func)) {
                    const jsDocParamInfo = getJSDocParams(func);
                    const jsDocParamTypeInfo = getJSDocParamsType(func);
                    const jsDocsParamOptionalInfo = getJSDocParamsOptionalType(func);

                    const [lastParameter] = func.parameters.slice(-1);
                    const isStreamingFunction = isLastParameterStreaming(lastParameter);
                    const paramsToParse = isStreamingFunction
                        ? func.parameters.slice(0, func.parameters.length - 1)
                        : func.parameters.slice(0, func.parameters.length);

                    const parameters = getParameters(paramsToParse,jsDocParamTypeInfo,jsDocParamInfo,jsDocsParamOptionalInfo);

                    const description = getDescription(func);
                    const helpUrl = getHelpUrl(func);

                    const result = getResults(func, isStreamingFunction, lastParameter);

                    const options = getOptions(func, isStreamingFunction);

                    let funcName:string = "";
                    if (func.name) {
                        funcName = func.name.text;
                    }

                    const metadataItem: CustomFunctionMetadata.Function = {
                        id: funcName,
                        name: funcName.toUpperCase(),
                        helpUrl,
                        description,
                        parameters,
                        result,
                        options,
                    };

                    if (!options.volatile && !options.stream) {
                        delete metadataItem.options;
                    }

                     metadata.push(metadataItem);
                }
                else {
                    //Function was skipped
                    if (func.name) {
                        // @ts-ignore
                        skippedFunctions.push(func.name.text);
                    }
                }
            }
        }
        ts.forEachChild(node, visit);
    }
}

/**
 * Determines the options parameters for the json
 * @param func - Function
 * @param isStreamingFunction - Is is a steaming function
 */
function getOptions(func: ts.FunctionDeclaration, isStreamingFunction: boolean): CustomFunctionMetadata.FunctionOptions {
    const optionsItem: CustomFunctionMetadata.FunctionOptions = {
        volatile: isVolatile(func),
        cancelable: isStreamCancelable(func),
        stream: isStreaming(func, isStreamingFunction)
    }
    return optionsItem;
}

/**
 * Determines the results parameter for the json
 * @param func - Function
 * @param isStreaming - Is a streaming function
 * @param lastParameter - Last parameter of the function signature
 */
function getResults(func: ts.FunctionDeclaration, isStreaming: boolean, lastParameter: ts.ParameterDeclaration): CustomFunctionMetadata.FunctionResult {
    let resultType = "any";
    let resultDim = "scalar";
    const defaultResultItem: CustomFunctionMetadata.FunctionResult = {
        type: resultType,
        dimensionality: resultDim
    };

    if (isStreaming) {
        const lastParameterType = lastParameter.type as ts.TypeReferenceNode;
        if (!lastParameterType.typeArguments || lastParameterType.typeArguments.length !== 1) {
            logError("The 'CustomFunctions.StreamingHandler' needs to be passed in a single result type (e.g., 'CustomFunctions.StreamingHandler < number >')");
            return defaultResultItem;
        }
        let returnType = func.type as ts.TypeReferenceNode;
        if (returnType && returnType.getFullText().trim() !== 'void') {
            logError(`A streaming function should not have a return type.  Instead, its type should be based purely on what's inside "CustomFunctions.StreamingHandler<T>".`);
            return defaultResultItem;
        }
        resultType = getParamType(lastParameterType.typeArguments[0]);
        resultDim = getParamDim(lastParameterType.typeArguments[0]);
    } else if (func.type) {
        if (func.type.kind === ts.SyntaxKind.TypeReference &&
            (func.type as ts.TypeReferenceNode).typeName.getText() === 'Promise' &&
            (func.type as ts.TypeReferenceNode).typeArguments &&
            // @ts-ignore
            (func.type as ts.TypeReferenceNode).typeArguments.length === 1
        ) {
            // @ts-ignore
            resultType = getParamType((func.type as ts.TypeReferenceNode).typeArguments[0]);
            // @ts-ignore
            resultDim = getParamDim((func.type as ts.TypeReferenceNode).typeArguments[0]);
        }
        else {
            resultType = getParamType(func.type);
            resultDim = getParamDim(func.type);
        }
    } else {
        console.log("No return type specified. This could be .js filetype, so continue.");
    }

    //Check the code comments for @return parameter
    if (resultType == "any") {
        const resultFromComment = getReturnType(func);
        // @ts-ignore
        const checkType = TYPE_MAPPINGS_COMMENT[resultFromComment];
            if (!checkType) {
                logError("Unsupported type in code comment:" + resultFromComment);
            }
            else {
                resultType = resultFromComment;
            }
    }

    const resultItem: CustomFunctionMetadata.FunctionResult = {
        type: resultType,
        dimensionality: resultDim
    };

    //Only return dimensionality = matrix.  Default assumed scalar
    if (resultDim == "scalar") {
        delete resultItem.dimensionality;
    }

    return resultItem;
}

/**
 * Determines the parameter details for the json
 * @param params - Parameters
 * @param jsDocParamTypeInfo - jsDocs parameter type info
 * @param jsDocParamInfo = jsDocs parameter info
 */
function getParameters(params: ts.ParameterDeclaration[], jsDocParamTypeInfo: { [key: string]: string }, jsDocParamInfo: { [key: string]: string }, jsDocParamOptionalInfo: { [key: string]: string }): CustomFunctionMetadata.FunctionParameter[] {
    const parameterMetadata: CustomFunctionMetadata.FunctionParameter[] = [];
    const parameters = params
    .map((p: ts.ParameterDeclaration) => {
        const name = (p.name as ts.Identifier).text;
        let ptype = getParamType(p.type as ts.TypeNode);
        
        //Try setting type from parameter in code comment
        if (ptype == 'any'){
            ptype = jsDocParamTypeInfo[name];
            if (ptype) {
                // @ts-ignore
                const checkType = TYPE_MAPPINGS_COMMENT[ptype.toLocaleLowerCase()];
                if (!checkType) {
                    logError("Unsupported type in code comment:" + ptype);
                }
            }
        }

        const pmetadataitem: CustomFunctionMetadata.FunctionParameter = {
            name,
            description: jsDocParamInfo[name],
            type: ptype,
            dimensionality: getParamDim(p.type as ts.TypeNode),
            optional: getParamOptional(p, jsDocParamOptionalInfo)
        };

        //Only return dimensionality = matrix.  Default assumed scalar
        if (pmetadataitem.dimensionality == "scalar") {
            delete pmetadataitem.dimensionality;
        }

        parameterMetadata.push(pmetadataitem);

    })
    .filter(meta => meta);

     return parameterMetadata;
}

/**
 * Determines the description parameter for the json
 * @param node - jsDoc node
 */
export function getDescription(node: ts.Node): string {
    let description:string = "";
    //@ts-ignore
    if (node.jsDoc[0]) {
        //@ts-ignore
        description = node.jsDoc[0].comment;
    }
    return description;
}

/**
 * Returns true if function is a custom function
 * @param node - jsDocs node
 */
function isCustomFunction(node: ts.Node): boolean {
    let isCustomFunction = false;
    ts.getJSDocTags(node).forEach(
        (tag: ts.JSDocTag) => {
            if (containsTag(tag, CUSTOM_FUNCTION)) {
                isCustomFunction = true;
            }
        }
    );

    return isCustomFunction;
}

/**
 * Returns the @helpurl of the JSDoc
 * @param node Node
 */
function getHelpUrl(node: ts.Node): string {
    let helpUrl:string = "";
    ts.getJSDocTags(node).forEach(
        (tag: ts.JSDocTag) => {
            if (containsTag(tag, HELPURL_PARAM)) {
                if (tag.comment) {
                    helpUrl = tag.comment;
                }
            }
        }
    );
    return helpUrl;
}

/**
 * Returns true if volatile tag found in comments
 * @param node jsDocs node
 */
function isVolatile(node: ts.Node): boolean {
    let isVolatile = false;
    ts.getJSDocTags(node).forEach(
        (tag: ts.JSDocTag) => {
            if(containsTag(tag, VOLATILE)){
                isVolatile = true;
            }
        }
    );
    return isVolatile;
}

function containsTag(tag: ts.JSDocTag, tagName:string):boolean {
    let containsTag:boolean = false;
    if ((tag.tagName.escapedText as string).toLowerCase() === tagName) {
        containsTag = true;
    }
    return containsTag;
}

/**
 * Returns true if function is streaming
 * @param node - jsDocs node
 * @param streamFunction - Is streaming function already determined by signature
 */
function isStreaming(node: ts.Node, streamFunction: boolean): boolean {
    //If streaming already determined by function signature then return true
    if (streamFunction){
        return streamFunction;
    }
  
    let streaming = false;
    ts.getJSDocTags(node).forEach(
        (tag: ts.JSDocTag) => {
            if (containsTag(tag, STREAMING)) {
                streaming = true;
            }
        }
    );
    return streaming;
}

/**
 * Returns true if streaming function is cancelable
 * @param node - jsDocs node
 */
function isStreamCancelable(node: ts.Node): boolean {
    let streamCancel = false;
    ts.getJSDocTags(node).forEach(
        (tag: ts.JSDocTag) => {
            if (containsTag(tag, STREAMING)) {
                if (tag.comment){
                    if (tag.comment.toLowerCase() === CANCELABLE) {
                        streamCancel = true;
                    }
                }
            }
        }
    );
    return streamCancel;
}

/**
 * Returns return type of function from comments
 * @param node - jsDocs node
 */
function getReturnType(node: ts.Node): string {
    let type = 'any';
    ts.getJSDocTags(node).forEach(
        (tag: ts.JSDocTag) => {
            if (containsTag(tag, RETURN)) {
                // @ts-ignore
                if (tag.typeExpression){
                    // @ts-ignore
                    type = tag.typeExpression.getFullText().slice(1,tag.typeExpression.getFullText().length-1).toLowerCase();
                }
            }
        }
    );
    return type;

}

/**
* This method will parse out all of the @param tags of a JSDoc and return a dictionary
* @param node - The function to parse the JSDoc params from
*/
function getJSDocParams(node: ts.Node): { [key: string]: string } {
    const jsDocParamInfo = {};

    ts.getAllJSDocTagsOfKind(node, ts.SyntaxKind.JSDocParameterTag).forEach(
        (tag: ts.JSDocTag) => {
            if (tag.comment) {
                const comment = (tag.comment.startsWith('-')
                    ? tag.comment.slice(1)
                    : tag.comment
                ).trim();
                // @ts-ignore
                jsDocParamInfo[(tag as ts.JSDocPropertyLikeTag).name.getFullText()] = comment;
            }
            else {
                //Description is missing so add empty string
                // @ts-ignore
                jsDocParamInfo[(tag as ts.JSDocPropertyLikeTag).name.getFullText()] = "";
            }
        }
    );

    return jsDocParamInfo;
}

/**
* This method will parse out all of the @param tags of a JSDoc and return a dictionary
* @param node - The function to parse the JSDoc params from
*/
function getJSDocParamsType(node: ts.Node): { [key: string]: string } {
    const jsDocParamTypeInfo = {};

    ts.getAllJSDocTagsOfKind(node, ts.SyntaxKind.JSDocParameterTag).forEach(
        // @ts-ignore
        (tag: ts.JSDocParameterTag) => {
            if (tag.typeExpression) {
                //Should be in the form {string}, so removing the {} around type
                const paramType = tag.typeExpression.getFullText().slice(1,tag.typeExpression.getFullText().length-1);
                // @ts-ignore
                jsDocParamTypeInfo[(tag as ts.JSDocPropertyLikeTag).name.getFullText()] = paramType;
            }
            else {
                // Set as any
                // @ts-ignore
                jsDocParamTypeInfo[(tag as ts.JSDocPropertyLikeTag).name.getFullText()] = "any";
            }
        }
    );

    return jsDocParamTypeInfo;
}

/**
* This method will parse out all of the @param tags of a JSDoc and return a dictionary
* @param node - The function to parse the JSDoc params from
*/
function getJSDocParamsOptionalType(node: ts.Node): { [key: string]: string } {
    const jsDocParamOptionalTypeInfo = {};

    ts.getAllJSDocTagsOfKind(node, ts.SyntaxKind.JSDocParameterTag).forEach(
        // @ts-ignore
        (tag: ts.JSDocParameterTag) => {
            // @ts-ignore
            jsDocParamOptionalTypeInfo[(tag as ts.JSDocPropertyLikeTag).name.getFullText()] = tag.isBracketed;
        }
    );

    return jsDocParamOptionalTypeInfo;
}

/**
 * Determines if the last parameter is streaming
 * @param param ParameterDeclaration
 */
function isLastParameterStreaming(param: ts.ParameterDeclaration): boolean {
    const isTypeReferenceNode = param && param.type && ts.isTypeReferenceNode(param.type);
    if (!isTypeReferenceNode) {
        return false;
    }

    const typeRef = param.type as ts.TypeReferenceNode;
    return (
        typeRef.typeName.getText() === 'CustomFunctions.StreamingHandler' ||
        typeRef.typeName.getText() === 'IStreamingCustomFunctionHandler' /* older version*/
    );
}

/**
 * Gets the parameter type of the node
 * @param t TypeNode
 */
function getParamType(t: ts.TypeNode): string {
    let type = 'any';
    //Only get type for typescript files.  js files will return any for all types
    if (t) {
        let kind = t.kind;
        if (ts.isTypeReferenceNode(t)) {
            const arrTr = t as ts.TypeReferenceNode;
            if (arrTr.typeName.getText() !== 'Array') {
                logError("Invalid type: " + arrTr.typeName.getText());
                return type;
            }
            if (arrTr.typeArguments) {
            const isArrayWithTypeRefWithin = validateArray(t) && ts.isTypeReferenceNode(arrTr.typeArguments[0]);
                if (isArrayWithTypeRefWithin) {
                    const inner = arrTr.typeArguments[0] as ts.TypeReferenceNode;
                    if (!validateArray(inner)) {
                        logError("Invalid type array: " + inner.getText());
                        return type;
                    }
                    if (inner.typeArguments) {
                        kind = inner.typeArguments[0].kind;
                    }
                }
            }
        }
        else if (ts.isArrayTypeNode(t)) {
            const inner = (t as ts.ArrayTypeNode).elementType;
            if (!ts.isArrayTypeNode(inner)) {
                logError("Invalid array type node: " + inner.getText());
                return type;
            }
            // Expectation is that at this point, "kind" is a primitive type (not 3D array).
            // However, if not, the TYPE_MAPPINGS check below will fail.
            kind = inner.elementType.kind;
        }
        // @ts-ignore
        type = TYPE_MAPPINGS[kind];
        if (!type) {
            logError("Type doesn't match mappings");
        }
    }
    return type;
}

/**
 * Get the parameter dimensionality of the node
 * @param t TypeNode
 */
function getParamDim(t: ts.TypeNode): string {
    let dimensionality: CustomFunctionsSchemaDimensionality = 'scalar';
    if (t) {
        if (ts.isTypeReferenceNode(t) || ts.isArrayTypeNode(t)) {
            dimensionality = 'matrix';
        }
    }
    return dimensionality;
}

function getParamOptional(p: ts.ParameterDeclaration, jsDocParamOptionalInfo: { [key: string]: string }): boolean {
    let optional = false;
    const name = (p.name as ts.Identifier).text;
    const isOptional = p.questionToken != null || p.initializer != null || p.dotDotDotToken != null;
    //If parameter is found to be optional in ts
    if (isOptional) {
        optional = true;
    //Else check the comments section for [name] format
    } else {
        // @ts-ignore
        optional = jsDocParamOptionalInfo[name];
    }
    return optional;
}

/**
 * This function will return `true` for `Array<[object]>` and `false` otherwise.
 * @param a - TypeReferenceNode
 */
function validateArray(a: ts.TypeReferenceNode) {
    return (
        a.typeName.getText() === 'Array' && a.typeArguments && a.typeArguments.length === 1
    );
}

/**
 * Log containing all the errors found while parsing
 * @param error Error string to add to the log
 */
export function logError(error: string) {
    // @ts-ignore
    errorLogFile.push(error);
}

