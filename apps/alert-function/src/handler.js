export function buildNotification(event) {
  if (!event?.eventId || !event?.projectId || !Number.isInteger(event?.percentage)) {
    throw new Error('invalid_progress_event');
  }
  const completed = event.percentage === 100;
  return {
    eventId: event.eventId,
    projectId: event.projectId,
    type: completed ? 'proyecto_completado' : 'avance_registrado',
    recipient: event.student || 'Estudiante',
    message: completed
      ? `El proyecto ${event.projectName} fue completado.`
      : `Se registró ${event.percentage}% de avance en ${event.projectName}.`
  };
}

