// EXEMPLO: Como adicionar logging às suas rotas
// Este é um arquivo de exemplo. Copie e adapte para suas rotas.

import logger from '../utils/logger.js'

// ========== EXEMPLO 1: CREATE (Criar Recurso) ==========
export const criarAluno = async (req, res) => {
  try {
    const userId = req.user?.id || 'anonymous'
    
    // Log do início da ação
    logger.userAction('aluno_criar_iniciado', userId)

    // Sua lógica de validação e criação
    const aluno = await criarNovoAluno(req.body)

    // Log de sucesso
    logger.success('Aluno criado com sucesso', {
      alunoId: aluno.id,
      email: aluno.email,
      userId
    })

    // Ação do usuário
    logger.userAction('aluno_criado', userId, {
      alunoId: aluno.id,
      email: aluno.email
    })

    // Database log
    logger.database('CREATE', 'aluno', 'success', {
      alunoId: aluno.id,
      userId
    })

    res.status(201).json(aluno)
  } catch (err) {
    logger.error(`Erro ao criar aluno [${req.method} ${req.path}]`, err, {
      userId: req.user?.id || 'anonymous',
      body: req.body
    })
    res.status(500).json({ error: 'Erro ao criar aluno' })
  }
}

// ========== EXEMPLO 2: READ (Obter Recurso) ==========
export const obterAluno = async (req, res) => {
  try {
    const userId = req.user?.id || 'anonymous'
    const alunoId = req.params.id

    // Log da ação
    logger.userAction('aluno_visualizado', userId, { alunoId })

    const aluno = await buscarAluno(alunoId)

    if (!aluno) {
      logger.warn('Aluno não encontrado', { alunoId, userId })
      return res.status(404).json({ error: 'Aluno não encontrado' })
    }

    // Database log
    logger.database('READ', 'aluno', 'success', {
      alunoId,
      userId
    })

    res.status(200).json(aluno)
  } catch (err) {
    logger.error(`Erro ao obter aluno [${req.method} ${req.path}]`, err, {
      userId: req.user?.id || 'anonymous',
      alunoId: req.params.id
    })
    res.status(500).json({ error: 'Erro ao obter aluno' })
  }
}

// ========== EXEMPLO 3: UPDATE (Atualizar Recurso) ==========
export const atualizarAluno = async (req, res) => {
  try {
    const userId = req.user?.id || 'anonymous'
    const alunoId = req.params.id

    logger.userAction('aluno_atualizar_iniciado', userId, { alunoId })

    const alunoAtualizado = await atualizarAlunoNoBD(alunoId, req.body)

    logger.success('Aluno atualizado com sucesso', {
      alunoId,
      userId,
      camposAlterados: Object.keys(req.body).join(', ')
    })

    logger.userAction('aluno_atualizado', userId, {
      alunoId,
      camposAlterados: Object.keys(req.body)
    })

    logger.database('UPDATE', 'aluno', 'success', {
      alunoId,
      userId,
      campos: Object.keys(req.body)
    })

    res.status(200).json(alunoAtualizado)
  } catch (err) {
    logger.error(`Erro ao atualizar aluno [${req.method} ${req.path}]`, err, {
      userId: req.user?.id || 'anonymous',
      alunoId: req.params.id
    })
    res.status(500).json({ error: 'Erro ao atualizar aluno' })
  }
}

// ========== EXEMPLO 4: DELETE (Deletar Recurso) ==========
export const deletarAluno = async (req, res) => {
  try {
    const userId = req.user?.id || 'anonymous'
    const alunoId = req.params.id

    logger.userAction('aluno_deletar_iniciado', userId, { alunoId })

    await deletarAlunoDoBD(alunoId)

    logger.success('Aluno deletado com sucesso', {
      alunoId,
      userId
    })

    logger.userAction('aluno_deletado', userId, { alunoId })

    logger.database('DELETE', 'aluno', 'success', {
      alunoId,
      userId
    })

    res.status(200).json({ message: 'Aluno deletado com sucesso' })
  } catch (err) {
    logger.error(`Erro ao deletar aluno [${req.method} ${req.path}]`, err, {
      userId: req.user?.id || 'anonymous',
      alunoId: req.params.id
    })
    res.status(500).json({ error: 'Erro ao deletar aluno' })
  }
}

// ========== EXEMPLO 5: Validação com Erro ==========
export const validarDados = async (req, res) => {
  try {
    const userId = req.user?.id || 'anonymous'

    // Validação
    if (!req.body.email || !req.body.nome) {
      logger.warn('Validação falhou - campos obrigatórios', {
        userId,
        camposFaltando: !req.body.email ? 'email' : 'nome'
      })
      return res.status(400).json({ error: 'Email e nome são obrigatórios' })
    }

    // Se chegou aqui, passou na validação
    logger.info('Dados validados com sucesso', { userId })
    
    res.status(200).json({ message: 'Dados válidos' })
  } catch (err) {
    logger.error('Erro na validação', err, { userId: req.user?.id })
    res.status(500).json({ error: 'Erro na validação' })
  }
}

// ========== EXEMPLO 6: Operação em Lote ==========
export const importarAlunos = async (req, res) => {
  try {
    const userId = req.user?.id || 'anonymous'
    const totalAlunos = req.body.alunos.length

    logger.userAction('importacao_iniciada', userId, { totalAlunos })

    let sucessos = 0
    let erros = 0

    for (const aluno of req.body.alunos) {
      try {
        const novoAluno = await criarNovoAluno(aluno)
        sucessos++
        logger.database('CREATE', 'aluno', 'success', {
          alunoId: novoAluno.id,
          userId
        })
      } catch (err) {
        erros++
        logger.warn(`Erro ao importar aluno individual`, {
          email: aluno.email,
          userId,
          erro: err.message
        })
      }
    }

    logger.success('Importação concluída', {
      userId,
      totalAlunos,
      sucessos,
      erros
    })

    logger.userAction('importacao_concluida', userId, {
      totalAlunos,
      sucessos,
      erros
    })

    res.status(200).json({
      message: 'Importação concluída',
      sucessos,
      erros,
      total: totalAlunos
    })
  } catch (err) {
    logger.error('Erro na importação em lote', err, {
      userId: req.user?.id,
      totalAlunos: req.body.alunos.length
    })
    res.status(500).json({ error: 'Erro na importação' })
  }
}

// ========== PADRÃO GERAL ==========
/**
 * 1. Capture userId no início: const userId = req.user?.id || 'anonymous'
 * 2. Faça log da ação iniciada: logger.userAction('acao_iniciada', userId)
 * 3. Faça log de sucessos: logger.success(...) + logger.userAction('acao_concluida', ...)
 * 4. Faça log de erros: logger.error(...)
 * 5. Faça log de avisos: logger.warn(...) para situações anômalas
 * 6. Database logs: logger.database(...) para operações de BD
 * 
 * DADOS SENSÍVEIS SERÃO AUTOMATICAMENTE REDACTADOS!
 * Não se preocupe em não passar password, token, etc. - o logger cuida disso.
 */

export default {
  criarAluno,
  obterAluno,
  atualizarAluno,
  deletarAluno,
  validarDados,
  importarAlunos
}
