#:sdk Aspire.AppHost.Sdk@13.6.1
#:package Aspire.Hosting.PostgreSQL@13.6.1
#:property AspireUseCliBundle=true
#:property UserSecretsId=kifo-clanker-apphost

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

var bot = builder.AddDockerfile("bot", "../..")
    .WithOtlpExporter(Aspire.Hosting.OtlpProtocol.HttpProtobuf)
    .WithEnvironment("DISCORD_TOKEN", discordToken)
    .WithEnvironment("DATABASE_URL", database.Resource.UriExpression)
    .WithHttpEndpoint(targetPort: 8080, name: "health")
    .WithHttpHealthCheck("/health/ready", endpointName: "health")
    .WaitFor(database)
    .WaitForCompletion(migrations);

foreach (var name in new[] { "BOT_OWNER_IDS", "SCHEDULER_PAUSED", "DISCORD_TEST_GUILD_ID", "DISCORD_DEPLOY_CHANNEL_ID", "DISCORD_LOG_CHANNEL_ID", "GITHUB_REPOSITORY", "JOKE_API_URL" })
{
    if (!string.IsNullOrWhiteSpace(builder.Configuration[name]))
        bot.WithEnvironment(name, builder.Configuration[name]);
}
foreach (var name in new[] { "LANGUAGE_DETECT_KEY", "GITHUB_TOKEN", "GITHUB_KEY" })
{
    if (!string.IsNullOrWhiteSpace(builder.Configuration[name]))
        bot.WithEnvironment(name, builder.AddParameterFromConfiguration(name.ToLowerInvariant().Replace('_', '-'), name, secret: true));
}

builder.Build().Run();
