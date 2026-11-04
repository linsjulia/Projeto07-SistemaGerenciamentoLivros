import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import * as db from './database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, 'public');
const PORT = process.env.PORT || 3000;

const STATUS_VALIDOS = ['Quero ler', 'Lendo', 'Concluído'];

const contentTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.ico': 'image/x-icon',
    '.png': 'image/png',
    '.svg': 'image/svg+xml'
};

// ---------- utilitários ----------

function sendJson(response, statusCode, data) {
    response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify(data));
}

function getRequestBody(request) {
    return new Promise((resolve, reject) => {
        let body = '';
        request.on('data', chunk => {
            body += chunk.toString();
            if (body.length > 1e6) {
                reject(new Error('Corpo da requisição muito grande.'));
                request.destroy();
            }
        });
        request.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch {
                const erro = new Error('JSON inválido no corpo da requisição.');
                erro.statusCode = 400;
                reject(erro);
            }
        });
        request.on('error', reject);
    });
}

function serveStaticFile(response, file) {
    fs.readFile(file, (err, data) => {
        if (err) {
            response.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
            return response.end('<h1>404 - Página não encontrada</h1><p><a href="/">Voltar ao início</a></p>');
        }
        const ext = path.extname(file).toLowerCase();
        response.writeHead(200, { 'Content-Type': contentTypes[ext] || 'application/octet-stream' });
        response.end(data);
    });
}

// ---------- validação ----------

function normalizarIsbn(valor) {
    return String(valor ?? '').replace(/[\s-]/g, '').toUpperCase();
}

// Retorna { erro } ou { dados } já saneados.
function validarLivro(entrada) {
    if (typeof entrada !== 'object' || entrada === null || Array.isArray(entrada)) {
        return { erro: 'Corpo da requisição inválido.' };
    }

    const titulo = String(entrada.titulo ?? '').trim();
    const autor = String(entrada.autor ?? '').trim();
    const genero = String(entrada.genero ?? '').trim();
    const status = String(entrada.status ?? '').trim();
    const anoTexto = String(entrada.ano ?? '').trim();
    const isbn = normalizarIsbn(entrada.isbn);
    const capa = String(entrada.capa ?? '').trim();

    const faltando = [];
    if (!titulo) faltando.push('título');
    if (!autor) faltando.push('autor');
    if (!anoTexto) faltando.push('ano de publicação');
    if (!genero) faltando.push('gênero');
    if (!status) faltando.push('status');
    if (faltando.length) {
        return { erro: `Preencha os campos obrigatórios: ${faltando.join(', ')}.` };
    }

    if (!/^\d{1,4}$/.test(anoTexto)) {
        return { erro: 'O ano de publicação deve ser um número inteiro válido.' };
    }
    const ano = Number(anoTexto);
    const anoMaximo = new Date().getFullYear() + 1;
    if (ano < 1 || ano > anoMaximo) {
        return { erro: `O ano de publicação deve estar entre 1 e ${anoMaximo}.` };
    }

    if (!STATUS_VALIDOS.includes(status)) {
        return { erro: `Status inválido. Use: ${STATUS_VALIDOS.join(', ')}.` };
    }

    if (isbn && !/^(\d{9}[\dX]|\d{13})$/.test(isbn)) {
        return { erro: 'ISBN inválido. Informe 10 ou 13 caracteres (hífens são opcionais).' };
    }

    if (capa && !/^https?:\/\//i.test(capa)) {
        return { erro: 'A URL da capa deve começar com http:// ou https://.' };
    }

    return { dados: { titulo, autor, isbn, ano, genero, status, capa } };
}

function lerId(texto) {
    return /^\d+$/.test(texto) ? Number(texto) : null;
}

// ---------- rotas da API ----------

async function tratarApi(request, response, url) {
    const metodo = request.method;
    const partes = url.pathname.replace(/\/+$/, '').split('/').filter(Boolean); // ['api','livros',':id']

    if (partes[1] !== 'livros' || partes.length > 3) {
        return sendJson(response, 404, { erro: 'Rota da API não encontrada.' });
    }

    const idTexto = partes[2];

    // /api/livros
    if (idTexto === undefined) {
        if (metodo === 'GET') {
            return sendJson(response, 200, db.listar(url.searchParams.get('titulo') || ''));
        }

        if (metodo === 'POST') {
            const corpo = await getRequestBody(request);
            const { erro, dados } = validarLivro(corpo);
            if (erro) return sendJson(response, 400, { erro });

            if (dados.isbn && db.buscarPorIsbn(dados.isbn)) {
                return sendJson(response, 409, { erro: 'Já existe um livro cadastrado com este ISBN.' });
            }

            const livro = db.inserir(dados);
            response.setHeader('Location', `/api/livros/${livro.id}`);
            return sendJson(response, 201, livro);
        }

        response.setHeader('Allow', 'GET, POST');
        return sendJson(response, 405, { erro: 'Método não permitido.' });
    }

    // /api/livros/:id
    const id = lerId(idTexto);
    if (id === null) {
        return sendJson(response, 400, { erro: 'ID inválido.' });
    }

    if (metodo === 'GET') {
        const livro = db.buscarPorId(id);
        if (!livro) return sendJson(response, 404, { erro: 'Livro não encontrado.' });
        return sendJson(response, 200, livro);
    }

    if (metodo === 'PUT') {
        if (!db.buscarPorId(id)) {
            return sendJson(response, 404, { erro: 'Livro não encontrado.' });
        }
        const corpo = await getRequestBody(request);
        const { erro, dados } = validarLivro(corpo);
        if (erro) return sendJson(response, 400, { erro });

        const duplicado = dados.isbn && db.buscarPorIsbn(dados.isbn);
        if (duplicado && duplicado.id !== id) {
            return sendJson(response, 409, { erro: 'Já existe outro livro cadastrado com este ISBN.' });
        }

        return sendJson(response, 200, db.atualizar(id, dados));
    }

    if (metodo === 'DELETE') {
        if (!db.remover(id)) return sendJson(response, 404, { erro: 'Livro não encontrado.' });
        return sendJson(response, 200, { mensagem: 'Livro excluído com sucesso.' });
    }

    response.setHeader('Allow', 'GET, PUT, DELETE');
    return sendJson(response, 405, { erro: 'Método não permitido.' });
}

// ---------- servidor ----------

async function callback(request, response) {
    try {
        const url = new URL(request.url, `http://${request.headers.host}`);
        let pathname;
        try {
            pathname = decodeURIComponent(url.pathname);
        } catch {
            return sendJson(response, 400, { erro: 'URL inválida.' });
        }

        if (pathname === '/api' || pathname.startsWith('/api/')) {
            return await tratarApi(request, response, url);
        }

        if (request.method !== 'GET' && request.method !== 'HEAD') {
            return sendJson(response, 405, { erro: 'Método não permitido.' });
        }

        const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
        const file = path.resolve(publicDir, relativePath);

        if (!file.startsWith(path.resolve(publicDir) + path.sep)) {
            response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
            return response.end('Proibido');
        }

        serveStaticFile(response, file);
    } catch (erro) {
        const status = erro.statusCode || 500;
        sendJson(response, status, {
            erro: status === 500 ? 'Erro interno do servidor.' : erro.message
        });
    }
}

http.createServer(callback).listen(PORT, () => {
    console.log(`Servidor iniciado em http://localhost:${PORT}/`);
});
