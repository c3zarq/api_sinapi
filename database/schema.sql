create database if not exists db_sinapi_pintura
    character set utf8mb4
    collate utf8mb4_unicode_ci;

USE db_sinapi_pintura;

-- Catálogo Serviços de Pintura
create table composicoes (
    codigo  varchar(20) primary key,
    grupo varchar(100) not null,
    etapa varchar(80) not null,
    demaos varchar(50) not null,
    descricao TEXT not null,
    unidade varchar(15) not null,
    INDEX idx_filtros (grupo, etapa, demaos)
);

-- Série histórica mensal de preços
create table composições_precos (
    id int auto_increment primary key,
    codigo_sinapi varchar(20) not null,
    uf char(2) not null default 'RS',
    mes_referencia varchar(7) not null,
    regime ENUM('CSD', 'CCD') not null default 'CSD', -- Composições 'com' e 'sem' desoneraçção
    custo_unitario decimal(12, 2) not null,
    percentual_as decimal(6, 4) default 0.0000, -- Atributo São Paulo
    unique key uk_preco_mensal (codigo_sinapi, uf, mes_referencia, regime), -- Unicidade, a combinação não pode ser duplicada
    index idx_ref (uf, mes_referencia, regime), -- Indice para localizar o mês sem varrer toda a tabela
    foreign key (codigo_sinapi) references composicoes(codigo) on delete cascade -- bloqueia a inserção para códigos inexistentes, e apaga os todos preços mensais vinculados a ela
);

-- Auditorias de Orçamento
create table auditorias (
    id int auto_increment primary key,
    titulo_obra varchar(150) not null,
    uf char(2) not null default 'RS',
    mes_referencia varchar(7) not null default '2026-10',
    regime ENUM('CSD', 'CCD') not null default 'CSD',
    bdi_aplicado decimal(7, 2) not null default 0.00,
    tolerancia_percentual decimal(5, 2) not null default 5.00,
    total_informado decimal(14, 2) not null,
    total_referencia decimal(14, 2) not null,
    divergencia_total decimal(14, 2) not null,
    criado_em timestamp default current_timestamp
 );

-- Itens auditados comparados ao sinapi
create table auditoria_itens (
    id int auto_increment primary key,
    auditoria_id int not null,
    codigo_sinapi varchar(20) not null,
    desccricao_informada varchar(255),
    quantidade decimal(12, 4) not null,
    preco_unitario_informado decimal(12, 2) not null,
    preco_unitario_referencia decimal(12, 2) null,
    diferenca_percentual decimal(8, 2) null,
    status ENUM('CONFORME', 'SOBREPRECO', 'SUBPRECO', 'CODIGO_NAO_ENCONTRADO') not null,
    foreign key (auditoria_id) references auditorias(id) on delete cascade
);