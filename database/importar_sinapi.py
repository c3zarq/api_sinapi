import re
import openpyxl

ARQUIVO_XLSX = "SINAPI_Referência_2026_10.xlsx"
ARQUIVO_PINTURA = "Itens_de_Pintura.txt"
ARQUIVO_SQL_SAIDA = "seed_sinapi_pintura_rs.sql"

selecionados = {}
with open(ARQUIVO_PINTURA, "r", encoding="utf-8") as f:
    for linha in f:
        linha = linha.strip()
        if not linha:
            continue
        partes = linha.split("\t") if "\t" in linha else re.split(r"\s{2,}, linha")
        if len(partes) >= 2:
            selecionados[partes[1].strip()] = partes[0].strip()

def classificar_servico(descricao):
    d = descricao.upper()
    if any(k in d for k in ["EMASSAMENTO", "MASSA"]):
        etapa = "Emassamento / Regularização"
    elif any(k in d for k in ["LIXAMENTO", "PREPARO", "JATEAMENTO", "FITA PROTETORA"]):
        etapa = "Preparação / Lixamento"
    elif any(k in d for k in ["FUNDO", "SELADOR", "IMUNIZANTE"]):
        etapa = "Fundo / Selador"
    else:
        etapa = "Pintura / Acabamento"

    if "3 DEM" in d or "03 DEM" in d:
        demaos = "3 demãos"
    elif "2 DEM" in d or "02 DEM" in d or "DUAS DEM" in d:
        demaos = "2 demãos"
    elif "1 DEM" in d or "01 DEM" in d or "UMA DEM" in d:
        demaos = "1 demãos"
    elif "POR DEM" in d:
        demaos = "Por demão"
    else:
        demaos = "Única / Não especificado"

    return etapa, demaos

wb = openpyxl.load_workbook(ARQUIVO_XLSX, data_only=False, read_only=True)
ws = wb["CSD"]

catalogo_sql = []
precos_sql = []

for i, row in enumerate(ws.iter_rows(values_only=True)):
    if i < 10:
        continue

    celula_codigo = str(row[1]).strip() if row[1] is not None else ""
    match = re.search(r'(?:,\s*"?(\d+)"?\s*\)$|^(\d+)$)', celula_codigo)
    if not match:
        continue

    codigo = match.group(1) or match.group(2)
    if codigo not in selecionados:
        continue

    grupo = selecionados[codigo].replace("'","''")
    descricao = str(row[2]).strip().replace("'","''")
    unidade = str(row[3]).strip().replace("'","''")
    etapa, demaos = classificar_servico(descricao)

    catalogo_sql.append(
        f"('{codigo}', '{grupo}', '{etapa}', '{demaos}', '{descricao}', '{unidade}')"
    )

    custo_rs = row[48]
    perc_as_rs = row[49]
    if isinstance(custo_rs, (int, float)) and custo_rs > 0:
        as_val = float(perc_as_rs) if isinstance(perc_as_rs, (int, float)) else 0.0
        precos_sql.append(
            f"('{codigo}', 'RS', '2026-10', 'CSD', {custo_rs:.2f}, {as_val:.4f})"
        )

wb.close()

if not catalogo_sql:
    raise RuntimeError("Nenhum item encontreado. Verifique Itens_de_Pintura,txt e a planilha")


with open(ARQUIVO_SQL_SAIDA, "w", encoding="utf-8") as f:
    f.write("USE db_sinapi_pintura;\n\n")
    f.write(
        "INSERT INTO composicoes (codigo, grupo, etapa, demaos, descricao, unidade) VALUES\n"
        + ",\n".join(catalogo_sql)
        + ";\n"
    )
    f.write(
        "INSERT INTO composicoes_precos (codigo_sinapi, uf, mes_referencia, regime, custo_unitario, percentual_as) VALUES\n"
        + ",\n".join(precos_sql)
        + ";\n"
    )

print(f"Catálogo: {len(catalogo_sql)} itens | Preços RS (2026-10): {len(precos_sql)} itens.")