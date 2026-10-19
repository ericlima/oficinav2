-- Oficina (dados do cabeçalho dos documentos)
CREATE TABLE oficina (
    id            SERIAL PRIMARY KEY,
    nome          VARCHAR(120) NOT NULL,      -- Baixinho Car
    descricao     VARCHAR(200),               -- Serviços Automotivos Nacionais e Importados
    cnpj          VARCHAR(18),
    telefone_1    VARCHAR(20),
    telefone_2    VARCHAR(20),
    endereco      VARCHAR(200)                -- Rua Dr. João Éboli, 71 - Vila Nova - Santos/SP
);

-- Vendedor
CREATE TABLE vendedor (
    id         SERIAL PRIMARY KEY,
    nome       VARCHAR(100) NOT NULL,
    ativo      BOOLEAN NOT NULL DEFAULT TRUE
);

-- Cliente
CREATE TABLE cliente (
    id          SERIAL PRIMARY KEY,
    nome        VARCHAR(120) NOT NULL,
    cpf         VARCHAR(14) UNIQUE,
    endereco    VARCHAR(200),
    telefone    VARCHAR(20),
    criado_em   TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Veículo (carro)
CREATE TABLE veiculo (
    id          SERIAL PRIMARY KEY,
    cliente_id  INT NOT NULL REFERENCES cliente(id),
    marca       VARCHAR(60) NOT NULL,
    modelo      VARCHAR(60) NOT NULL,
    ano         SMALLINT,
    cor         VARCHAR(30),
    placa       VARCHAR(8) UNIQUE,
    chassi      VARCHAR(17) UNIQUE,
    motor       VARCHAR(40)
);

-- Orçamento (cabeçalho)
CREATE TABLE orcamento (
    id            SERIAL PRIMARY KEY,
    numero        INT GENERATED ALWAYS AS IDENTITY UNIQUE,
    oficina_id    INT NOT NULL REFERENCES oficina(id),
    cliente_id    INT NOT NULL REFERENCES cliente(id),
    veiculo_id    INT NOT NULL REFERENCES veiculo(id),
    vendedor_id   INT REFERENCES vendedor(id),
    data          DATE NOT NULL DEFAULT CURRENT_DATE,
    km            INT,                                  -- km do veículo no momento
    status        VARCHAR(20) NOT NULL DEFAULT 'ABERTO'
                  CHECK (status IN ('ABERTO','APROVADO','RECUSADO','CONCLUIDO')),
    observacoes   TEXT,
    total_geral   NUMERIC(12,2) NOT NULL DEFAULT 0
);

-- Itens do orçamento (Quant. / Discriminação / Total)
CREATE TABLE orcamento_item (
    id              SERIAL PRIMARY KEY,
    orcamento_id    INT NOT NULL REFERENCES orcamento(id) ON DELETE CASCADE,
    item_numero     SMALLINT NOT NULL,                  -- 1, 2, 3...
    quantidade      NUMERIC(10,2) NOT NULL DEFAULT 1,
    discriminacao   VARCHAR(300) NOT NULL,              -- serviço ou peça
    tipo            VARCHAR(10) NOT NULL DEFAULT 'SERVICO'
                    CHECK (tipo IN ('SERVICO','PECA')),
    valor_unitario  NUMERIC(12,2) NOT NULL DEFAULT 0,
    total           NUMERIC(12,2) GENERATED ALWAYS AS (quantidade * valor_unitario) STORED,
    UNIQUE (orcamento_id, item_numero)
);

-- Recibo (gerado a partir de um orçamento aprovado/pago)
CREATE TABLE recibo (
    id               SERIAL PRIMARY KEY,
    numero           INT GENERATED ALWAYS AS IDENTITY UNIQUE,
    orcamento_id     INT NOT NULL REFERENCES orcamento(id),
    data_emissao     DATE NOT NULL DEFAULT CURRENT_DATE,
    valor            NUMERIC(12,2) NOT NULL,
    forma_pagamento  VARCHAR(30),                       -- dinheiro, pix, cartão...
    descricao        TEXT                               -- texto do recibo
);

-- Índices úteis
CREATE INDEX idx_veiculo_cliente   ON veiculo(cliente_id);
CREATE INDEX idx_orcamento_cliente ON orcamento(cliente_id);
CREATE INDEX idx_orcamento_veiculo ON orcamento(veiculo_id);
CREATE INDEX idx_item_orcamento    ON orcamento_item(orcamento_id);