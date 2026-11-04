// Persistência em arquivo JSON (data/livros.json).
// Os dados continuam disponíveis após reiniciar o servidor.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, 'data');
const dbFile = path.join(dataDir, 'livros.json');

let estado = { proximoId: 1, livros: [] };

function carregar() {
    fs.mkdirSync(dataDir, { recursive: true });

    if (!fs.existsSync(dbFile)) {
        salvar();
        return;
    }

    try {
        const lido = JSON.parse(fs.readFileSync(dbFile, 'utf-8'));
        if (Array.isArray(lido.livros)) {
            const maiorId = lido.livros.reduce((m, l) => Math.max(m, l.id), 0);
            estado = {
                livros: lido.livros,
                proximoId: Math.max(Number(lido.proximoId) || 1, maiorId + 1)
            };
        }
    } catch (erro) {
        console.error('Arquivo de dados inválido, iniciando vazio:', erro.message);
    }
}

// Grava em arquivo temporário e renomeia, evitando arquivo corrompido.
function salvar() {
    const tmp = dbFile + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(estado, null, 2), 'utf-8');
    fs.renameSync(tmp, dbFile);
}

carregar();

export function listar(titulo = '') {
    const termo = titulo.trim().toLowerCase();
    const livros = termo
        ? estado.livros.filter(l => l.titulo.toLowerCase().includes(termo))
        : estado.livros;
    return [...livros].sort((a, b) => a.id - b.id);
}

export function buscarPorId(id) {
    return estado.livros.find(l => l.id === id) || null;
}

export function buscarPorIsbn(isbn) {
    return estado.livros.find(l => l.isbn && l.isbn === isbn) || null;
}

export function inserir(dados) {
    const livro = { id: estado.proximoId++, ...dados };
    estado.livros.push(livro);
    salvar();
    return livro;
}

export function atualizar(id, dados) {
    const indice = estado.livros.findIndex(l => l.id === id);
    if (indice === -1) return null;
    estado.livros[indice] = { id, ...dados };
    salvar();
    return estado.livros[indice];
}

export function remover(id) {
    const indice = estado.livros.findIndex(l => l.id === id);
    if (indice === -1) return false;
    estado.livros.splice(indice, 1);
    salvar();
    return true;
}
