output "cluster_endpoint" {
  value = aws_rds_cluster.this.endpoint
}

output "cluster_id" {
  value = aws_rds_cluster.this.id
}
