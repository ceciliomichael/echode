/**
 * Parser module exports
 * Provides a unified API for XML tool parsing functionality
 */

export { unescapeXml, escapeXml } from './xml-utils';

export {
  isInsideParameterValue,
  isInsideInvokeParameterValue,
  findMatchingClosingTag,
  findMatchingInvokeClosingTag,
  findMatchingParameterClose,
} from './tag-matcher';

export {
  extractFunctionCallsBlocks,
  extractInvokeBlocks,
  type FunctionCallsBlock,
  type InvokeBlock,
} from './block-extractor';

export {
  parseXMLParameters,
  parseParamValue,
  extractCompleteJsonObjects,
} from './parameter-parser';

export {
  cleanToolCallContent,
  removeThinkBlocks,
  removeCodeBlocks,
  preprocessContent,
} from './content-cleaner';
