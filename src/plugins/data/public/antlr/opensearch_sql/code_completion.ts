/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { monaco } from '@osd/monaco';
import { Lexer as LexerType, ParserRuleContext, Parser as ParserType } from 'antlr4ng';
import { CodeCompletionCore } from 'antlr4-c3';
import {
  AutocompleteResultBase,
  CursorPosition,
  EnrichAutocompleteResult,
  GetParseTree,
  KeywordSuggestion,
  LexerConstructor,
  OpenSearchSqlAutocompleteResult,
  ParserConstructor,
} from '../shared/types';
import { TokenDictionary } from './table';
import { createParser } from './parse';
import { SqlErrorListener } from './sql_error_listerner';
import { findCursorTokenIndex } from '../shared/cursor';
import { openSearchSqlAutocompleteData } from './opensearch_sql_autocomplete';
import { SQL_SYMBOLS } from './constants';
import { QuerySuggestion, QuerySuggestionGetFnArgs } from '../../autocomplete';
import { fetchTableSchemas, parseQuery } from '../shared/utils';
import { IDataFrameResponse, IFieldType } from '../../../common';
import { SuggestionItemDetailsTags } from '../shared/constants';

export interface SuggestionParams {
  position: monaco.Position;
  query: string;
}

export interface ISuggestionItem {
  text: string;
  type: string;
  fieldType?: string;
}

export const getSuggestions = async ({
  selectionStart,
  selectionEnd,
  position,
  query,
  services,
}: QuerySuggestionGetFnArgs): Promise<QuerySuggestion[]> => {
  const { api } = services.uiSettings;
  const dataSetManager = services.data.query.dataSetManager;
  const { lineNumber, column } = position || {};
  const suggestions = getOpenSearchSqlAutoCompleteSuggestions(query, {
    line: lineNumber || selectionStart,
    column: column || selectionEnd,
  });

  const finalSuggestions: QuerySuggestion[] = [];

  try {
    // Fetch columns and values
    if (suggestions.suggestColumns?.tables?.length) {
      const tableNames = suggestions.suggestColumns.tables.map((table) => table.name);
      const schemas = await fetchTableSchemas(tableNames, api, dataSetManager);

      (schemas as IDataFrameResponse[]).forEach((schema: IDataFrameResponse) => {
        if ('body' in schema && schema.body && 'fields' in schema.body) {
          const columns = schema.body.fields.find((col: IFieldType) => col.name === 'COLUMN_NAME');
          const fieldTypes = schema.body.fields.find((col: IFieldType) => col.name === 'TYPE_NAME');

          if (columns && fieldTypes) {
            finalSuggestions.push(
              ...columns.values.map((col: string, index: number) => ({
                text: col,
                type: monaco.languages.CompletionItemKind.Field,
                insertText: col,
                detail: fieldTypes.values[index],
                start: 0,
                end: 0,
              }))
            );
          }
        }
      });
    }

    // Fill in aggregate functions
    if (suggestions.suggestAggregateFunctions) {
      finalSuggestions.push(
        ...SQL_SYMBOLS.AGREGATE_FUNCTIONS.map((af) => ({
          text: af,
          type: monaco.languages.CompletionItemKind.Function,
          insertText: af,
          detail: SuggestionItemDetailsTags.AggregateFunction,
          start: 0,
          end: 0,
        }))
      );
    }

    // Fill in SQL keywords
    if (suggestions.suggestKeywords?.length) {
      finalSuggestions.push(
        ...suggestions.suggestKeywords.map((sk) => ({
          text: sk.value,
          type: monaco.languages.CompletionItemKind.Keyword,
          insertText: sk.value,
          detail: SuggestionItemDetailsTags.Keyword,
          start: 0,
          end: 0,
        }))
      );
    }
  } catch (error) {
    // TODO: Handle errors appropriately, possibly logging or displaying a message to the user
    return [];
  }

  return finalSuggestions;
};

export const getOpenSearchSqlAutoCompleteSuggestions = (
  query: string,
  cursor: CursorPosition
): OpenSearchSqlAutocompleteResult => {
  return parseQuery({
    Lexer: openSearchSqlAutocompleteData.Lexer,
    Parser: openSearchSqlAutocompleteData.Parser,
    tokenDictionary: openSearchSqlAutocompleteData.tokenDictionary,
    ignoredTokens: openSearchSqlAutocompleteData.ignoredTokens,
    rulesToVisit: openSearchSqlAutocompleteData.rulesToVisit,
    getParseTree: openSearchSqlAutocompleteData.getParseTree,
    enrichAutocompleteResult: openSearchSqlAutocompleteData.enrichAutocompleteResult,
    query,
    cursor,
  });
};
