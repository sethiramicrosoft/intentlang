import {
  codeActions,
  completionsAt,
  definitionAt,
  documentSymbols,
  hoverAt,
  languageDiagnostics,
  moduleLinks,
  referencesAt,
  renameAt,
  semanticTokens,
  traceLinks,
  type ServicePosition
} from "./language-service.js";

interface RpcRequest {
  jsonrpc: "2.0";
  id?: number | string;
  method: string;
  params?: any;
}

const documents = new Map<string, string>();
let buffer = Buffer.alloc(0);

function send(message: unknown): void {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  process.stdout.write(`Content-Length: ${body.length}\r\n\r\n`);
  process.stdout.write(body);
}

function response(request: RpcRequest, result: unknown): void {
  if (request.id !== undefined) {
    send({ jsonrpc: "2.0", id: request.id, result });
  }
}

function publish(uri: string): void {
  const source = documents.get(uri) ?? "";
  send({
    jsonrpc: "2.0",
    method: "textDocument/publishDiagnostics",
    params: {
      uri,
      diagnostics: languageDiagnostics(source).map((item) => ({
        range: {
          start: {
            line: Math.max(0, item.line - 1),
            character: Math.max(0, item.column - 1)
          },
          end: {
            line: Math.max(0, item.line - 1),
            character: Math.max(0, item.column - 1 + item.length)
          }
        },
        severity: 1,
        code: item.code,
        message: item.message,
        source: "intentlang",
        data: { hint: item.hint }
      }))
    }
  });
}

function sourceFor(params: any): { uri: string; source: string } {
  const uri = params.textDocument.uri as string;
  return { uri, source: documents.get(uri) ?? "" };
}

function tokenData(source: string): number[] {
  const legend = ["keyword", "type", "property", "function", "enumMember", "string", "number"];
  let previousLine = 0;
  let previousCharacter = 0;
  return semanticTokens(source).flatMap((token) => {
    const deltaLine = token.line - previousLine;
    const deltaCharacter =
      deltaLine === 0
        ? token.startCharacter - previousCharacter
        : token.startCharacter;
    previousLine = token.line;
    previousCharacter = token.startCharacter;
    return [
      deltaLine,
      deltaCharacter,
      token.length,
      legend.indexOf(token.tokenType),
      0
    ];
  });
}

function handle(request: RpcRequest): void {
  const params = request.params ?? {};
  if (request.method === "initialize") {
    response(request, {
      capabilities: {
        textDocumentSync: 1,
        documentSymbolProvider: true,
        definitionProvider: true,
        referencesProvider: true,
        renameProvider: true,
        hoverProvider: true,
        completionProvider: { triggerCharacters: [" ", "."] },
        codeActionProvider: true,
        documentLinkProvider: {},
        semanticTokensProvider: {
          legend: {
            tokenTypes: ["keyword", "type", "property", "function", "enumMember", "string", "number"],
            tokenModifiers: []
          },
          full: true
        }
      },
      serverInfo: { name: "IntentLang", version: "0.8.0-alpha.0" }
    });
    return;
  }
  if (request.method === "initialized" || request.method === "shutdown") {
    response(request, null);
    return;
  }
  if (request.method === "exit") {
    process.exit(0);
  }
  if (request.method === "textDocument/didOpen") {
    documents.set(params.textDocument.uri, params.textDocument.text);
    publish(params.textDocument.uri);
    return;
  }
  if (request.method === "textDocument/didChange") {
    documents.set(
      params.textDocument.uri,
      params.contentChanges.at(-1)?.text ?? ""
    );
    publish(params.textDocument.uri);
    return;
  }
  if (request.method === "textDocument/didClose") {
    documents.delete(params.textDocument.uri);
    return;
  }
  const { uri, source } = sourceFor(params);
  const position = params.position as ServicePosition;
  if (request.method === "textDocument/documentSymbol") {
    const symbolKinds = {
      application: 2,
      entity: 5,
      field: 8,
      relationship: 7,
      action: 12,
      role: 10
    };
    response(
      request,
      documentSymbols(source).map((symbol) => ({
        name: symbol.name,
        detail: symbol.id ? `${symbol.detail} (${symbol.id})` : symbol.detail,
        kind: symbolKinds[symbol.kind],
        range: symbol.range,
        selectionRange: symbol.selectionRange
      }))
    );
  } else if (request.method === "textDocument/definition") {
    response(request, definitionAt(source, uri, position) ?? null);
  } else if (request.method === "textDocument/references") {
    response(request, referencesAt(source, uri, position));
  } else if (request.method === "textDocument/rename") {
    response(request, renameAt(source, uri, position, params.newName));
  } else if (request.method === "textDocument/hover") {
    const hover = hoverAt(source, position);
    response(
      request,
      hover
        ? {
            contents: { kind: "markdown", value: hover.contents },
            range: hover.range
          }
        : null
    );
  } else if (request.method === "textDocument/completion") {
    response(request, {
      isIncomplete: false,
      items: completionsAt(source, position).map((item) => ({
        label: item.label,
        kind: item.kind === "snippet" ? 15 : item.kind === "symbol" ? 6 : 14,
        insertText: item.insertText,
        insertTextFormat: item.kind === "snippet" ? 2 : 1,
        detail: item.detail
      }))
    });
  } else if (request.method === "textDocument/codeAction") {
    response(
      request,
      codeActions(source).map((action) => ({
        title: action.title,
        kind: "quickfix",
        diagnostics: params.context?.diagnostics?.filter(
          (diagnostic: any) => diagnostic.code === action.diagnosticCode
        ),
        edit: action.replacement
          ? {
              changes: {
                [uri]: [
                  {
                    range: action.replacement.range,
                    newText: action.replacement.text
                  }
                ]
              }
            }
          : undefined
      }))
    );
  } else if (request.method === "textDocument/semanticTokens/full") {
    response(request, { data: tokenData(source) });
  } else if (request.method === "textDocument/documentLink") {
    response(request, moduleLinks(source, uri));
  } else if (request.method === "intentlang/trace") {
    response(request, traceLinks(source, uri));
  } else {
    response(request, null);
  }
}

process.stdin.on("data", (chunk: Buffer) => {
  buffer = Buffer.concat([buffer, chunk]);
  while (true) {
    const headerEnd = buffer.indexOf("\r\n\r\n");
    if (headerEnd < 0) return;
    const header = buffer.subarray(0, headerEnd).toString("ascii");
    const length = /Content-Length:\s*(\d+)/i.exec(header);
    if (!length) {
      buffer = Buffer.alloc(0);
      return;
    }
    const bodyStart = headerEnd + 4;
    const bodyLength = Number(length[1]);
    if (buffer.length < bodyStart + bodyLength) return;
    const body = buffer.subarray(bodyStart, bodyStart + bodyLength).toString("utf8");
    buffer = buffer.subarray(bodyStart + bodyLength);
    handle(JSON.parse(body) as RpcRequest);
  }
});
