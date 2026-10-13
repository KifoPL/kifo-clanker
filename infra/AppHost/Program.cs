var builder = DistributedApplication.CreateBuilder(args);

var discordToken = builder.AddParameter("discord-token", secret: true);
var postgresPassword = builder.AddParameter("postgres-password", secret: true);
var postgres = builder.AddPostgres("postgres", password: postgresPassword)
    .WithImageTag("18.6")
    .WithDataVolume("kifo-clanker-postgres-data");
var database = postgres.AddDatabase("clanker");

var migrations = builder.AddDockerfile("migrations", "../..")
    .WithArgs("dist/scripts/migrate.js")
    .WithEnvironment("DATABASE_URL", database.Resource.UriExpression)
    .WaitFor(database);

builder.AddDockerfile("bot", "../..")
    .WithOtlpExporter(Aspire.Hosting.OtlpProtocol.HttpProtobuf)
    .WithEnvironment("DISCORD_TOKEN", discordToken)
    .WithEnvironment("DATABASE_URL", database.Resource.UriExpression)
    .WithHttpEndpoint(targetPort: 8080, name: "health")
    .WithHttpHealthCheck("/health/ready", endpointName: "health")
    .WaitFor(database)
    .WaitForCompletion(migrations);

builder.Build().Run();
