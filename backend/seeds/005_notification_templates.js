/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function(knex) {
  // Get all tenants to create templates for each
  const tenants = await knex('tenants').select('id', 'name');
  
  // Delete existing templates
  await knex('notification_templates').del();

  // Default notification templates
  const defaultTemplates = [
    {
      type: 'campaign_created',
      name: 'Nueva Campaña Creada',
      content: `🙏 *Nueva Campaña - {{campaign_title}}*

¡Hola hermano/a en Cristo!

Tenemos una nueva campaña para ayudar a familias necesitadas:

📋 *Descripción:* {{campaign_description}}
💰 *Meta:* {{target_amount}}
📅 *Fecha límite:* {{end_date}}

Tu donación puede hacer la diferencia. ¡Que Dios bendiga tu generosidad!

_Para donar, responde a este mensaje o visita nuestro sitio web._`,
      variables: ['campaign_title', 'campaign_description', 'target_amount', 'end_date']
    },
    {
      type: 'campaign_goal_reached',
      name: 'Meta de Campaña Alcanzada',
      content: `🎉 *¡Meta Alcanzada! - {{campaign_title}}*

¡Gloria a Dios! Hemos alcanzado la meta de nuestra campaña:

💰 *Meta alcanzada:* {{target_amount}}
💝 *Total recaudado:* {{raised_amount}}
👥 *Donantes:* {{donor_count}} hermanos

Gracias a tu generosidad, {{completion_percentage}}% de la meta fue completada.

¡Que Dios multiplique tu bendición!`,
      variables: ['campaign_title', 'target_amount', 'raised_amount', 'donor_count', 'completion_percentage']
    },
    {
      type: 'campaign_urgent',
      name: 'Campaña Urgente',
      content: `🚨 *URGENTE - {{campaign_title}}*

Hermano/a, necesitamos tu ayuda urgente:

⏰ *Quedan {{days_remaining}} días*
📊 *Progreso:* {{completion_percentage}}%

*Necesidades más urgentes:*
{{urgent_items}}

Tu donación HOY puede marcar la diferencia para familias que esperan nuestra ayuda.

¡Que Dios toque tu corazón!`,
      variables: ['campaign_title', 'days_remaining', 'completion_percentage', 'urgent_items']
    },
    {
      type: 'campaign_ending',
      name: 'Campaña Terminando',
      content: `⏰ *Últimos días - {{campaign_title}}*

¡Quedan solo {{days_remaining}} días para completar esta campaña!

📊 *Progreso actual:* {{completion_percentage}}%
💰 *Faltan:* {{remaining_amount}} de {{target_amount}}

Esta es tu última oportunidad de participar en esta obra de caridad.

¡No dejes pasar esta bendición!`,
      variables: ['campaign_title', 'days_remaining', 'completion_percentage', 'remaining_amount', 'target_amount']
    },
    {
      type: 'donation_thank_you',
      name: 'Agradecimiento por Donación',
      content: `🙏 *¡Gracias {{donor_name}}!*

Tu donación de {{donation_amount}} para la campaña "{{campaign_title}}" ha sido recibida con mucha gratitud.

✨ *Tu impacto:* {{impact_message}}

"Cada uno dé como propuso en su corazón: no con tristeza, ni por necesidad, porque Dios ama al dador alegre." - 2 Corintios 9:7

¡Que Dios bendiga abundantemente tu generosidad!`,
      variables: ['donor_name', 'donation_amount', 'campaign_title', 'impact_message']
    },
    {
      type: 'weekly_summary',
      name: 'Resumen Semanal',
      content: `📊 *Resumen Semanal de Donaciones*

¡Hola hermano/a! Te compartimos lo que logramos juntos esta semana:

💰 *Total donado:* {{week_donations}}
👥 *Donantes activos:* {{week_donors}}
📋 *Campañas activas:* {{active_campaigns}}
👨‍👩‍👧‍👦 *Familias ayudadas:* {{families_helped}}

*Campaña destacada:* {{top_campaign}}

¡Gracias por ser parte de esta obra de amor!

"Mejor es dar que recibir" - Hechos 20:35`,
      variables: ['week_donations', 'week_donors', 'active_campaigns', 'families_helped', 'top_campaign']
    },
    {
      type: 'monthly_report',
      name: 'Reporte Mensual',
      content: `📈 *Reporte Mensual - Pan Compartido*

¡Querido hermano/a en Cristo!

Este mes, juntos hemos logrado:

💰 *Total recaudado:* {{month_donations}}
👥 *Donantes participantes:* {{month_donors}}
✅ *Campañas completadas:* {{completed_campaigns}}
👨‍👩‍👧‍👦 *Familias beneficiadas:* {{families_helped}}

*Testimonios del mes:*
{{impact_stories}}

¡Tu fidelidad en dar está transformando vidas!

"Dad, y se os dará" - Lucas 6:38`,
      variables: ['month_donations', 'month_donors', 'completed_campaigns', 'families_helped', 'impact_stories']
    },
    {
      type: 'emergency_alert',
      name: 'Alerta de Emergencia',
      content: `{{priority_icon}} *ALERTA IMPORTANTE*

{{alert_message}}

*Fecha:* {{timestamp}}

Por favor, mantente atento a futuras comunicaciones.

Que Dios nos guíe en estos momentos.`,
      variables: ['alert_message', 'priority_icon', 'timestamp']
    }
  ];

  // Create templates for each tenant
  const templatesToInsert = [];
  
  for (const tenant of tenants) {
    for (const template of defaultTemplates) {
      templatesToInsert.push({
        tenant_id: tenant.id,
        type: template.type,
        name: template.name,
        content: template.content,
        variables: JSON.stringify(template.variables),
        active: true,
        created_at: new Date(),
        updated_at: new Date()
      });
    }
  }

  // Insert all templates
  if (templatesToInsert.length > 0) {
    await knex('notification_templates').insert(templatesToInsert);
  }

  console.log(`Created ${templatesToInsert.length} notification templates for ${tenants.length} tenants`);
};