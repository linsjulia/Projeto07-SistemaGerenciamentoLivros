// Front-end do Acervo de Livros: comunica-se com a API REST e com a Open Library via fetch().

const API = '/api/livros';
const OPEN_LIBRARY = 'https://openlibrary.org/search.json';

const $ = id => document.getElementById(id);
const campos = ['titulo', 'autor', 'isbn', 'ano', 'genero', 'status'];

let timerMensagem;
let timerPesquisa;

// ---------- mensagens ----------

function mostrarMensagem(texto, tipo = 'sucesso') {
    const el = $('mensagem');
    el.textContent = texto;
    el.className = `mensagem ${tipo}`;
    el.hidden = false;
    clearTimeout(timerMensagem);
    timerMensagem = setTimeout(() => { el.hidden = true; }, 6000);
}

// ---------- chamadas à API própria ----------

async function requisicao(url, opcoes = {}) {
    let resposta;
    try {
        resposta = await fetch(url, {
            headers: { 'Content-Type': 'application/json' },
            ...opcoes
        });
    } catch {
        throw new Error('Não foi possível comunicar com o servidor.');
    }

    let corpo = null;
    try { corpo = await resposta.json(); } catch { /* resposta sem corpo */ }

    if (!resposta.ok) {
        throw new Error((corpo && corpo.erro) || `Erro ${resposta.status} ao processar a requisição.`);
    }
    return corpo;
}

// ---------- listagem ----------

function classeStatus(status) {
    return { 'Quero ler': 'quero-ler', 'Lendo': 'lendo', 'Concluído': 'concluido' }[status] || '';
}

function elemento(tag, props = {}, ...filhos) {
    const el = document.createElement(tag);
    Object.entries(props).forEach(([k, v]) => {
        if (k === 'className') el.className = v;
        else if (k === 'onclick') el.addEventListener('click', v);
        else el.setAttribute(k, v);
    });
    filhos.forEach(f => el.append(f));
    return el;
}

function criarCartao(livro) {
    const capa = livro.capa
        ? elemento('img', { className: 'capa', src: livro.capa, alt: `Capa de ${livro.titulo}`, loading: 'lazy' })
        : elemento('div', { className: 'sem-capa' }, 'Sem capa');

    capa.addEventListener?.('error', () => capa.replaceWith(elemento('div', { className: 'sem-capa' }, 'Sem capa')));

    const info = elemento('div', { className: 'info' },
        elemento('span', { className: `badge ${classeStatus(livro.status)}` }, livro.status),
        elemento('h3', {}, livro.titulo),
        elemento('p', {}, `Autor: ${livro.autor}`),
        elemento('p', {}, `Ano: ${livro.ano} · Gênero: ${livro.genero}`),
        elemento('p', {}, `ISBN: ${livro.isbn || '—'} · ID: ${livro.id}`),
        elemento('div', { className: 'botoes' },
            elemento('button', { className: 'btn secundario pequeno', onclick: () => iniciarEdicao(livro.id) }, 'Editar'),
            elemento('button', { className: 'btn perigo pequeno', onclick: () => excluirLivro(livro) }, 'Excluir')
        )
    );

    return elemento('article', { className: 'livro' }, capa, info);
}

async function carregarLivros() {
    const termo = $('pesquisa').value.trim();
    try {
        const livros = await requisicao(`${API}?titulo=${encodeURIComponent(termo)}`);
        const lista = $('lista');
        lista.replaceChildren();

        if (!livros.length) {
            lista.append(elemento('div', { className: 'vazio' },
                termo ? 'Nenhum livro encontrado para essa pesquisa.' : 'Nenhum livro cadastrado ainda.'));
        } else {
            livros.forEach(l => lista.append(criarCartao(l)));
        }
        $('contador').textContent = `(${livros.length})`;
    } catch (erro) {
        mostrarMensagem(erro.message, 'erro');
    }
}

// ---------- formulário ----------

function lerFormulario() {
    return {
        titulo: $('titulo').value.trim(),
        autor: $('autor').value.trim(),
        isbn: $('isbn').value.trim(),
        ano: $('ano').value.trim(),
        genero: $('genero').value.trim(),
        status: $('status').value,
        capa: $('capa').value.trim()
    };
}

function validarFormulario(dados) {
    campos.forEach(c => $(c).classList.remove('invalido'));
    const obrigatorios = { titulo: 'título', autor: 'autor', ano: 'ano de publicação', genero: 'gênero', status: 'status' };
    const faltando = Object.keys(obrigatorios).filter(c => !dados[c]);
    faltando.forEach(c => $(c).classList.add('invalido'));

    if (faltando.length) {
        return `Preencha os campos obrigatórios: ${faltando.map(c => obrigatorios[c]).join(', ')}.`;
    }
    if (!/^\d{1,4}$/.test(dados.ano) || Number(dados.ano) < 1) {
        $('ano').classList.add('invalido');
        return 'Informe um ano de publicação válido.';
    }
    const isbn = dados.isbn.replace(/[\s-]/g, '');
    if (isbn && !/^(\d{9}[\dXx]|\d{13})$/.test(isbn)) {
        $('isbn').classList.add('invalido');
        return 'ISBN inválido. Informe 10 ou 13 caracteres.';
    }
    return null;
}

function atualizarPreviaCapa() {
    const url = $('capa').value;
    $('capaPreview').hidden = !url;
    if (url) $('capaImg').src = url;
}

function limparFormulario() {
    $('formLivro').reset();
    $('livroId').value = '';
    $('capa').value = '';
    campos.forEach(c => $(c).classList.remove('invalido'));
    $('resultadosApi').hidden = true;
    $('resultadosApi').replaceChildren();
    $('tituloFormulario').textContent = 'Cadastrar livro';
    $('btnSalvar').textContent = 'Cadastrar';
    $('btnCancelar').hidden = true;
    atualizarPreviaCapa();
}

async function iniciarEdicao(id) {
    try {
        const livro = await requisicao(`${API}/${id}`);
        limparFormulario();
        $('livroId').value = livro.id;
        campos.forEach(c => { $(c).value = livro[c] ?? ''; });
        $('capa').value = livro.capa || '';
        $('tituloFormulario').textContent = `Editar livro #${livro.id}`;
        $('btnSalvar').textContent = 'Salvar alterações';
        $('btnCancelar').hidden = false;
        atualizarPreviaCapa();
        $('cadastro').scrollIntoView({ behavior: 'smooth' });
    } catch (erro) {
        mostrarMensagem(erro.message, 'erro');
        carregarLivros();
    }
}

async function salvarLivro(evento) {
    evento.preventDefault();
    const dados = lerFormulario();
    const erroValidacao = validarFormulario(dados);
    if (erroValidacao) return mostrarMensagem(erroValidacao, 'erro');

    const id = $('livroId').value;
    const botao = $('btnSalvar');
    botao.disabled = true;

    try {
        await requisicao(id ? `${API}/${id}` : API, {
            method: id ? 'PUT' : 'POST',
            body: JSON.stringify(dados)
        });
        mostrarMensagem(id ? 'Livro atualizado com sucesso!' : 'Livro cadastrado com sucesso!');
        limparFormulario();
        await carregarLivros();
    } catch (erro) {
        mostrarMensagem(erro.message, 'erro');
    } finally {
        botao.disabled = false;
    }
}

async function excluirLivro(livro) {
    if (!confirm(`Deseja realmente excluir o livro "${livro.titulo}"?`)) return;

    try {
        await requisicao(`${API}/${livro.id}`, { method: 'DELETE' });
        mostrarMensagem('Livro excluído com sucesso!');
        if ($('livroId').value === String(livro.id)) limparFormulario();
    } catch (erro) {
        mostrarMensagem(erro.message, 'erro');
    }
    carregarLivros();
}

// ---------- integração com a Open Library ----------

async function buscarNaOpenLibrary() {
    const titulo = $('titulo').value.trim();
    if (!titulo) {
        $('titulo').classList.add('invalido');
        return mostrarMensagem('Digite um título para buscar na Open Library.', 'erro');
    }
    $('titulo').classList.remove('invalido');

    const botao = $('btnBuscarApi');
    const area = $('resultadosApi');
    botao.disabled = true;
    botao.textContent = 'Buscando...';

    const controle = new AbortController();
    const timeout = setTimeout(() => controle.abort(), 8000);

    try {
        const params = new URLSearchParams({
            title: titulo,
            limit: '6',
            fields: 'title,author_name,first_publish_year,isbn,cover_i,subject'
        });
        const resposta = await fetch(`${OPEN_LIBRARY}?${params}`, { signal: controle.signal });
        if (!resposta.ok) throw new Error('API indisponível');
        const dados = await resposta.json();

        area.replaceChildren();
        if (!dados.docs || !dados.docs.length) {
            area.hidden = true;
            return mostrarMensagem('Nenhum resultado encontrado na Open Library. Preencha o cadastro manualmente.', 'aviso');
        }

        dados.docs.forEach(doc => area.append(criarResultadoApi(doc)));
        area.hidden = false;
    } catch {
        area.hidden = true;
        mostrarMensagem('Não foi possível consultar a Open Library no momento. Você pode cadastrar o livro manualmente.', 'aviso');
    } finally {
        clearTimeout(timeout);
        botao.disabled = false;
        botao.textContent = 'Buscar na Open Library';
    }
}

function criarResultadoApi(doc) {
    const capaUrl = doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : '';
    const autor = (doc.author_name || [])[0] || 'Autor desconhecido';
    const ano = doc.first_publish_year || 's/d';

    const miniatura = capaUrl
        ? elemento('img', { src: capaUrl, alt: `Capa de ${doc.title}`, loading: 'lazy' })
        : elemento('div', { className: 'sem-capa' }, 'Sem capa');

    const botao = elemento('button', { type: 'button', className: 'resultado-api' },
        miniatura,
        elemento('div', {},
            elemento('strong', {}, doc.title || 'Sem título'),
            elemento('span', {}, autor),
            elemento('span', {}, `Publicado em: ${ano}`)
        )
    );

    botao.addEventListener('click', () => {
        $('titulo').value = doc.title || '';
        $('autor').value = autor === 'Autor desconhecido' ? '' : autor;
        $('ano').value = doc.first_publish_year || '';
        const isbn = (doc.isbn || []).find(i => /^(\d{13}|\d{9}[\dX])$/.test(i));
        $('isbn').value = isbn || '';
        if (!$('genero').value && doc.subject && doc.subject.length) $('genero').value = doc.subject[0];
        $('capa').value = capaUrl;
        atualizarPreviaCapa();
        $('resultadosApi').hidden = true;
        mostrarMensagem('Dados preenchidos. Revise, escolha o status e salve.', 'sucesso');
    });

    return botao;
}

// ---------- eventos ----------

$('formLivro').addEventListener('submit', salvarLivro);
$('btnLimpar').addEventListener('click', limparFormulario);
$('btnCancelar').addEventListener('click', limparFormulario);
$('btnBuscarApi').addEventListener('click', buscarNaOpenLibrary);
$('btnRemoverCapa').addEventListener('click', () => { $('capa').value = ''; atualizarPreviaCapa(); });
$('titulo').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); buscarNaOpenLibrary(); }
});
$('pesquisa').addEventListener('input', () => {
    clearTimeout(timerPesquisa);
    timerPesquisa = setTimeout(carregarLivros, 250);
});

carregarLivros();
