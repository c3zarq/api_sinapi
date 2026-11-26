const js2xmlparser = require('js2xmlparser');

function enviarResposta(req, res, statusCode, rootElement, dados){
    const querXml = 
        req.query?.formato?.toLowerCase() === 'xml' ||
        (req.headers.accept && req.headers.accept.includes('application/xml'));

    if (querXml) {
        const xml = js2xmlparser.parse(rootElement, dados, {
            declaration: {encoding: 'UTF-8'},
            format: {doubleQuotes: true, pretty: true}
        });
        return res.status(statusCode).type('application/xml').send(xml);
    }

    return res.status(statusCode).json(dados);
}

module.exports = enviarResposta;