output "backend_ecr_repository_url" {
  description = "Push the backend image here from CI."
  value       = aws_ecr_repository.backend.repository_url
}

output "frontend_ecr_repository_url" {
  description = "Push the frontend image here from CI."
  value       = aws_ecr_repository.frontend.repository_url
}

output "ecs_cluster_name" {
  description = "ECS cluster the services will run in (compute TBD)."
  value       = aws_ecs_cluster.this.name
}
