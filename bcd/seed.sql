-- database: login.db
-- ===============================================
-- SEED.SQL - DADOS INICIAIS (SYNTAX.lab)
-- ===============================================
-- 1. Inserir Clientes
INSERT INTO clientes (nome, email, senha, idade, data_nascimento, genero, hora_contato, data_disponivel) VALUES
('João da Silva', 'joaosilva@gmail.com', '123456', 35, '1989-05-12', 'Masculino', '14:00', '2026-10-20'),
('Maria Souza', 'mariasouza@gmail.com', '123456', 29, '1995-08-22', 'Feminino', '10:00', '2026-10-21'),
('Carlos Lima', 'carloslima@gmail.com', '123456', 42, '1982-11-03', 'Masculino', '16:30', '2026-10-22'),
('Ana Paula', 'anapaula@gmail.com', '1309227462', 31, '1993-02-18', 'Feminino', '09:00', '2026-10-25'),
('Roberto Alves', 'robertoalves@gmail.com', '123456', 50, '1974-07-30', 'Masculino', '11:00', '2026-10-26');
-- 2. Inserir Técnicos
INSERT INTO tecnicos (nome, email, senha, idade, data_nascimento, genero, nivel_conhecimento, bio, hora_contato, data_disponivel) VALUES
('João Silva', 'joao.tecnico@syntaxlab.com', '123456', 28, '1996-03-15', 'Masculino', 'PLENO', 'Especialista em manutenção de eletrônicos.', '08:00', '2026-10-17'),
('Maria Santos', 'maria.tecnica@syntaxlab.com', '123456', 34, '1990-09-10', 'Feminino', 'SÊNIOR', 'Experiência com refrigeração.', '13:00', '2026-10-17'),
('Carlos Lima', 'carlos.tecnico@syntaxlab.com', '123456', 24, '2000-01-25', 'Masculino', 'JÚNIOR', 'Técnico em mecânica industrial.', '15:00', '2026-10-18'),
('Ana Paula', 'ana.tecnica@syntaxlab.com', '123456', 30, '1994-06-05', 'Feminino', 'PLENO', 'Manutenção de informática.', '10:30', '2026-10-19'),
('Roberto Alves', 'roberto.tecnico@syntaxlab.com', '123456', 45, '1979-12-12', 'Masculino', 'SÊNIOR', 'Instalações elétricas.', '09:00', '2026-10-19');
-- 3. Inserir Ordens de Serviço
INSERT INTO ordens_servico (cliente_id, tecnico_id, equipamento, status, data_abertura) VALUES
(1, 3, 'Ar-condicionado', 'Em andamento', '2026-09-16'),
(2, 4, 'Geladeira', 'Concluída', '2026-09-15'),
(3, 5, 'Máquina de lavar', 'Pendente', '2026-09-14'),
(4, 1, 'Ar-condicionado', 'Em andamento', '2026-09-13'),
(5, 2, 'Freezer', 'Concluída', '2026-09-12');
