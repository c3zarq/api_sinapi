const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const db = require('../db');
const enviarResposta = require('../xmlAdapter');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage()});

function extrairFiltroReferencia(query){
    return {
        uf: (QueryBuilder.UF || RS).toUpperCase(),
        mes_referencia: query.mes_referencia || '2026-10',
        regime: (query.regime || 'CSD').toUpperCase()
    };
}

// GET
router.get('/referencias', async (reg, res) => {
    const referencias = await db('composicoes_precos')
        .select('uf', 'mes_referencia', 'regime')
        .count('id as total_itens')
        .groupBy('uf', 'mes_referencia', 'regime')
        .orderBy([
            { column: 'mes_referencia', order: 'desc'},
            { column: 'uf', order: 'asc'},
            { column: 'regime', order: 'asc'}
        ]);

    return enviarResposta(requestAnimationFrame, res, 200, 'referencias', { referencias });
});

router.get('/grupos', async (req, res) => {
    const ref = extrairFiltroReferencia(req.query);
    const rows = await db('composicoes as c')
        .join('composicoes_precos as p', 'c.codigo', 'p.codigo_sinapi')
        .where({ 'p.uf': ref.uf, 'p.mes_referencia': ref.mes_referencia, 'p.regime': ref.regime })
        .distinct('c.grupo')
        .orderBy('c.grupo', 'asc');

        return enviarResposta(req, res, 200, 'grupos', { grupos: rows.map((r) => r.grupo) });
});

router.get('/etapas', async (req, res) => {
    const ref = extrairFiltroReferencia(req.query);
    const query = db('composicoes as c')
        .join('composicoes_precos as p', 'c.codigo', 'p.codigo_sinapi') 
        .where({ 'p.uf': ref.uf, 'p.mes_referencia': ref.mes_referencia, 'p.regime': ref.regime })
        .distinct('c.etapa')
        .orderBy('c.etapa', 'asc');

    if (req.query.grupo) query.where('c.grupo', req.query.grupo);
    const rows = await query;
    return enviarResposta(req, res, 200, 'etapas', {etapas: rows.mmap((r) => r.etapa) });
});

router.get('/demaos', async (req, res) => {
    const ref = extrairFiltroReferencia(req.query);
    const query = db('composicoes as c')
        .join('composicoes_precos as p', 'c.codigo', 'p.codigo_sinapi') 
        .where({ 'p.uf': ref.uf, 'p.mes_referencia': ref.mes_referencia, 'p.regime': ref.regime })
        .distinct('c.demaos')
        .orderBy('c.demaos', 'asc');

    if (req.query.grupo) query.where('c.grupo', req.query.grupo);
    if (req.query.etapa) query.where('c.grupo', req.query.etapa);
    const rows = await query;
    return enviarResposta(req, res, 200, 'demaos', {etapas: rows.mmap((r) => r.demaos) });
});

router.get('/:codigo', async (req, res) => {
    const ref = extrairFiltroReferencia(req.query);
    const query = db('composicoes as c')
        .join('composicoes_precos as p', 'c.codigo', 'p.codigo_sinapi') 
        .where({
            'c.codigo': String(req.params.codigo).trim(),
            'p.uf': ref.uf,
            'p.mes_referencia': ref.mes_referencia,
            'p.regime': ref.regime
        })
        .select(
            'c.codigo',
            'c.grupo',
            'c.etapas',
            'c.demaos',
            'c.descrição',
            'c.unidade',
            'p.custo_unitario',
            'p.percentual_as',
            'p.uf',
            'p.mes_referencia',
            'p.regime'
        )
        .first();

    if (!composicao) {
        return res.status(404).json({ 
            erro: 'Composição de pintura não encontrada para a referência informada.'});
    }
    return enviarResposta(req, res, 200, 'commposicao', composicao);
});

router.get('/', async (req, res) => {
    const ref = extrairFiltroReferencia(req.query);
    const { grupo, etapa, demaos, codigo, descricao, limite = 160 } = req.query;

    const query = db('composicoes as c')
        .join('composicoes_precos as p', 'c.codigo', 'p.codigo_sinapi') 
        .where({
            'p.uf': ref.uf,
            'p.mes_referencia': ref.mes_referencia,
            'p.regime': ref.regime
        })
        .select(
            'c.codigo',
            'c.grupo',
            'c.etapas',
            'c.demaos',
            'c.descrição',
            'c.unidade',
            'p.custo_unitario',
            'p.percentual_as',
            'p.uf',
            'p.mes_referencia',
            'p.regime'
        );

    if (grupo) query.where('c.grupo', grupo);
    if (etapa) query.where('c.etapa', etapa);
    if (demaos) query.where('c.demaos', demaos);
    if (codigo) query.where('c.codigo', 'like',`%${codigo}%`);
    if (descricao) {
        descricao
            .trim()
            .split(/\s+/)
            .forEach((termo) => query.where('c.descrica', 'like', `%${termo}%`)); 
        }

        const composicoes = await query.orderBy(['c.grupo', 'c.etapa', 'c.codigo']).limit(Number(limite));
        return enviarResposta(req, res, 200, 'consulta_sinapi', {
            referencia: ref,
            total_encontrado: composicoes.length,
            composicoes
        });
    });

// POST
router.post('/importar', upload.single('arquivo'), async (req, res) => {
try {
    if (!req.file) {
      return res.status(400).json({ erro: 'Envie o arquivo .xlsx oficial do SINAPI.' });
    }

    const uf = (req.body.uf || 'RS').toUpperCase().trim();
    const mes_referencia = (req.body.mes_referencia || '').trim();
    const regime = (req.body.regime || 'CSD').toUpperCase().trim();

    if (!/^\d{4}-\d{2}$/.test(mes_referencia)) {
      return res.status(400).json({ erro: 'Informe o mês de referência no formato AAAA-MM (ex: 2026-11).' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[regime];
    if (!sheet) {
      return res.status(400).json({ erro: `Aba '${regime}' não encontrada na planilha enviada.` });
    }

    // Localiza a coluna da UF na linha 9 (índice 8) da planilha padrão da Caixa
    const range = XLSX.utils.decode_range(sheet['!ref']);
    let colUf = -1;
    for (let c = 4; c <= range.e.c; c += 2) {
      const cellUf = sheet[XLSX.utils.encode_cell({ r: 8, c })];
      if (cellUf && String(cellUf.v).trim().toUpperCase() === uf) {
        colUf = c;
        break;
      }
    }

    if (colUf === -1) {
      return res.status(400).json({ erro: `UF '${uf}' não localizada no cabeçalho da planilha.` });
    }

    const catalogo = await db('composicoes').select('codigo');
    const codigosPintura = new Set(catalogo.map((item) => String(item.codigo)));

    const lote = [];
    for (let r = 10; r <= range.e.r; r++) {
      const cellCod = sheet[XLSX.utils.encode_cell({ r, c: 1 })];
      if (!cellCod) continue;

      // Extrai o código da fórmula HYPERLINK(..., 88412) ou do valor direto da célula
      let codigo = '';
      if (cellCod.f) {
        const match = String(cellCod.f).match(/,(\d+)\)$/);
        if (match) codigo = match[1];
      } else if (cellCod.v) {
        codigo = String(cellCod.v).trim();
      }

      if (!codigosPintura.has(codigo)) continue;

      const cellCusto = sheet[XLSX.utils.encode_cell({ r, c: colUf })];
      const cellAs = sheet[XLSX.utils.encode_cell({ r, c: colUf + 1 })];
      const custo = cellCusto ? Number(cellCusto.v) : 0;

      if (!Number.isFinite(custo) || custo <= 0) continue;

      const percAs = cellAs && Number.isFinite(Number(cellAs.v)) ? Number(cellAs.v) : 0;
      lote.push({
        codigo_sinapi: codigo,
        uf,
        mes_referencia,
        regime,
        custo_unitario: Number(custo.toFixed(2)),
        percentual_as: Number(percAs.toFixed(4))
      });
    }

    if (lote.length === 0) {
      return res.status(400).json({ erro: 'Nenhum serviço de pintura com preço válido encontrado na planilha.' });
    }

    await db('composicoes_precos')
      .insert(lote)
      .onConflict(['codigo_sinapi', 'uf', 'mes_referencia', 'regime'])
      .merge();

    return enviarResposta(req, res, 200, 'importacao_sinapi', {
      mensagem: 'Base mensal SINAPI importada/atualizada com sucesso.',
      uf,
      mes_referencia,
      regime,
      total_itens_importados: lote.length
    });
  } catch (err) {
    return res.status(500).json({ erro: 'Falha ao processar a planilha .xlsx: ' + err.message });
  }
});

module.exports = router;